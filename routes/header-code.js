const express = require('express');
const {
  validateHeaderCodeSnippetInput,
  listHeaderCodeSnippets,
  getHeaderCodeSnippetById,
  getHeaderCodeSnippetsForPublic,
  createHeaderCodeSnippet,
  updateHeaderCodeSnippet,
  deleteHeaderCodeSnippet,
  toggleHeaderCodeSnippetStatus
} = require('../database/header-code-manager');

const router = express.Router();

function requireAdminApi(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ success: false, message: 'Administrator authentication required.' });
}

function sendOperationError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  if (error && error.errors) {
    return res.status(400).json({
      success: false,
      message: 'Invalid snippet data.',
      errors: error.errors
    });
  }
  if (error && error.statusCode === 404) {
    return res.status(404).json({ success: false, message: 'Snippet not found.' });
  }
  if (error && error.code === 'ER_BAD_DB_ERROR') {
    return res.status(503).json({
      success: false,
      message: 'The configured MySQL server does not contain gym_bangluru. Check the Railway DB_HOST, DB_PORT, DB_USER and DB_PASSWORD settings, and confirm DB_NAME is gym_bangluru.'
    });
  }
  if (error && error.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({
      success: false,
      message: 'The existing header_code_snippets table is unavailable in gym_bangluru. Verify the table and its columns; this application will not create it.'
    });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
}

router.get('/public/header-code', async (req, res) => {
  try {
    const snippets = await getHeaderCodeSnippetsForPublic();
    res.set('Cache-Control', 'no-store');
    res.json({ snippets });
  } catch (error) {
    console.error('Could not load active header code snippets:', error);
    res.status(500).json({ success: false, message: 'Unable to load public snippets.' });
  }
});

router.get('/header-code', requireAdminApi, async (req, res) => {
  try {
    const snippets = await listHeaderCodeSnippets();
    res.json({ snippets });
  } catch (error) {
    sendOperationError(res, error, 'Unable to load snippets.');
  }
});

router.post('/header-code', requireAdminApi, async (req, res) => {
  const validation = validateHeaderCodeSnippetInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid snippet data.',
      errors: validation.errors
    });
  }

  try {
    const snippet = await createHeaderCodeSnippet(req.body);
    res.status(201).json({ success: true, snippet });
  } catch (error) {
    sendOperationError(res, error, 'Unable to create snippet.');
  }
});

router.get('/header-code/:id', requireAdminApi, async (req, res) => {
  try {
    const snippet = await getHeaderCodeSnippetById(req.params.id);
    if (!snippet) return res.status(404).json({ success: false, message: 'Snippet not found.' });
    res.json({ snippet });
  } catch (error) {
    sendOperationError(res, error, 'Unable to load snippet.');
  }
});

router.put('/header-code/:id', requireAdminApi, async (req, res) => {
  const validation = validateHeaderCodeSnippetInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid snippet data.',
      errors: validation.errors
    });
  }

  try {
    const snippet = await updateHeaderCodeSnippet(req.params.id, req.body);
    res.json({ success: true, snippet });
  } catch (error) {
    sendOperationError(res, error, 'Unable to update snippet.');
  }
});

router.delete('/header-code/:id', requireAdminApi, async (req, res) => {
  try {
    await deleteHeaderCodeSnippet(req.params.id);
    res.json({ success: true });
  } catch (error) {
    sendOperationError(res, error, 'Unable to delete snippet.');
  }
});

router.patch('/header-code/:id/status', requireAdminApi, async (req, res) => {
  const active = req.body && req.body.active;
  if (![true, false, 1, 0, '1', '0', 'true', 'false'].includes(active)) {
    return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
  }

  try {
    const snippet = await toggleHeaderCodeSnippetStatus(
      req.params.id,
      active === true || active === 1 || active === '1' || active === 'true'
    );
    res.json({ success: true, snippet });
  } catch (error) {
    sendOperationError(res, error, 'Unable to update snippet status.');
  }
});

module.exports = router;
