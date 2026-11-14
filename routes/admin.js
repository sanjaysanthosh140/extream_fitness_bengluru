const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getMarketingSettings, saveMarketingSettings } = require('../database/marketing-settings');
const {
  listHeaderCodeSnippets,
  getHeaderCodeSnippetById,
  createHeaderCodeSnippet,
  updateHeaderCodeSnippet,
  deleteHeaderCodeSnippet,
  toggleHeaderCodeSnippetStatus,
  validateHeaderCodeSnippetInput
} = require('../database/header-code-manager');

// Middleware - check login
function requireLogin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
}

// Redirect /admin to /admin/login or /admin/dashboard
router.get('/', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/admin/login');
});

// Login page
router.get('/login', (req, res) => {
  res.render('login');
});

// Login submit
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }

  res.render('login', { error: 'Invalid username or password' });
});

function getCsrfToken(req) {
  if (!req.session.adminCsrfToken) {
    req.session.adminCsrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.adminCsrfToken;
}

function isValidCsrfToken(expected, received) {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function validateMarketingSettings(body) {
  const settings = {
    gtmContainerId: String(body.gtm_container_id || '').trim().toUpperCase(),
    gaMeasurementId: String(body.ga_measurement_id || '').trim().toUpperCase(),
    searchConsoleToken: String(body.search_console_token || '').trim(),
    clarityProjectId: String(body.clarity_project_id || '').trim(),
    defaultLeadSource: String(body.default_lead_source || '').trim()
  };

  if (settings.gtmContainerId && !/^GTM-[A-Z0-9]+$/.test(settings.gtmContainerId)) {
    return { error: 'Enter a valid Google Tag Manager ID (for example, GTM-ABC1234).' };
  }
  if (settings.gaMeasurementId && !/^G-[A-Z0-9]+$/.test(settings.gaMeasurementId)) {
    return { error: 'Enter a valid Google Analytics 4 measurement ID (for example, G-ABC1234567).' };
  }
  if (settings.searchConsoleToken && !/^[A-Za-z0-9_-]{1,255}$/.test(settings.searchConsoleToken)) {
    return { error: 'The Search Console verification token can contain only letters, numbers, underscores, and hyphens.' };
  }
  if (settings.clarityProjectId && !/^[A-Za-z0-9-]{1,64}$/.test(settings.clarityProjectId)) {
    return { error: 'Enter a valid Microsoft Clarity project ID.' };
  }
  if (!settings.defaultLeadSource || settings.defaultLeadSource.length > 100) {
    return { error: 'Default lead source is required and must be 100 characters or fewer.' };
  }

  return { settings };
}

router.get('/marketing-settings', requireLogin, async (req, res) => {
  try {
    const settings = await getMarketingSettings();
    res.render('marketing-settings', {
      settings,
      csrfToken: getCsrfToken(req),
      success: req.query.saved === '1' ? 'Marketing settings saved.' : '',
      error: ''
    });
  } catch (error) {
    console.error('Could not load marketing settings:', error);
    res.status(500).send('Could not load marketing settings. Check the database connection and permissions.');
  }
});

router.get('/header-code-manager', requireLogin, async (req, res) => {
  try {
    res.render('header-code-manager');
  } catch (error) {
    console.error('Could not load header code manager page:', error);
    res.status(500).send('Could not load the Header Code Manager.');
  }
});

router.get('/header-code-manager/list', requireLogin, async (req, res) => {
  try {
    const snippets = await listHeaderCodeSnippets();
    res.json({ snippets });
  } catch (error) {
    console.error('Could not load snippets for admin:', error);
    res.status(500).json({ success: false, message: 'Unable to load snippets.' });
  }
});

router.post('/header-code-manager', requireLogin, async (req, res) => {
  try {
    const validation = validateHeaderCodeSnippetInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Invalid snippet data.', errors: validation.errors });
    }

    const snippet = await createHeaderCodeSnippet(req.body);
    res.status(201).json({ success: true, snippet });
  } catch (error) {
    console.error('Could not create header code snippet:', error);
    const message = error && error.errors ? 'Invalid snippet data.' : 'Unable to create snippet.';
    const statusCode = error && error.errors ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message,
      errors: error && error.errors ? error.errors : undefined
    });
  }
});

router.put('/header-code-manager/:id', requireLogin, async (req, res) => {
  try {
    const validation = validateHeaderCodeSnippetInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Invalid snippet data.', errors: validation.errors });
    }

    const snippet = await updateHeaderCodeSnippet(req.params.id, req.body);
    res.json({ success: true, snippet });
  } catch (error) {
    console.error('Could not update header code snippet:', error);
    const statusCode = error && error.statusCode === 404 ? 404 : 400;
    const message = error && error.statusCode === 404 ? 'Snippet not found.' : 'Unable to update snippet.';
    res.status(statusCode).json({
      success: false,
      message,
      errors: error && error.errors ? error.errors : undefined
    });
  }
});

router.delete('/header-code-manager/:id', requireLogin, async (req, res) => {
  try {
    await deleteHeaderCodeSnippet(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Could not delete header code snippet:', error);
    const statusCode = error && error.statusCode === 404 ? 404 : 500;
    const message = error && error.statusCode === 404 ? 'Snippet not found.' : 'Unable to delete snippet.';
    res.status(statusCode).json({ success: false, message });
  }
});

router.patch('/header-code-manager/:id/toggle-status', requireLogin, async (req, res) => {
  try {
    const snippet = await toggleHeaderCodeSnippetStatus(req.params.id);
    res.json({ success: true, snippet });
  } catch (error) {
    console.error('Could not toggle status for snippet:', error);
    const statusCode = error && error.statusCode === 404 ? 404 : 500;
    const message = error && error.statusCode === 404 ? 'Snippet not found.' : 'Unable to update status.';
    res.status(statusCode).json({ success: false, message });
  }
});

router.post('/marketing-settings', requireLogin, async (req, res) => {
  const csrfToken = getCsrfToken(req);
  if (!isValidCsrfToken(csrfToken, req.body.csrf_token)) {
    return res.status(403).send('Invalid form token. Reload the page and try again.');
  }

  const validation = validateMarketingSettings(req.body);
  if (validation.error) {
    return res.status(400).render('marketing-settings', {
      settings: req.body,
      csrfToken,
      success: '',
      error: validation.error
    });
  }

  try {
    await saveMarketingSettings(validation.settings);
    res.redirect('/admin/marketing-settings?saved=1');
  } catch (error) {
    console.error('Could not save marketing settings:', error);
    res.status(500).render('marketing-settings', {
      settings: req.body,
      csrfToken,
      success: '',
      error: 'Could not save settings. Check the database connection and permissions.'
    });
  }
});

// Dashboard
router.get('/dashboard', requireLogin, async (req, res) => {
  try {
    const [leads] = await db.execute('SELECT * FROM leads ORDER BY created_at DESC');
    res.render('dashboard', { leads, dbError: null });
  } catch (error) {
    console.error('Database query error in /admin/dashboard:', error.message || error);
    res.render('dashboard', {
      leads: [],
      dbError: error.message || 'Database connection error. Please ensure MySQL is running and the "emirates_first" database exists.'
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

//delete lead
router.delete('/leads/:id', requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.execute('DELETE FROM leads WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;