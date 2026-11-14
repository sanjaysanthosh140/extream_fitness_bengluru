const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
require('dotenv').config();

const formRoutes = require('./routes/form');
const adminRoutes = require('./routes/admin');
const headerCodeRoutes = require('./routes/header-code');
const { getMarketingSettings } = require('./database/marketing-settings');
const { getHeaderCodeSnippetsForPublic } = require('./database/header-code-manager');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // production-ൽ true ആക്കണം (https)
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/api', formRoutes);
app.use('/api', headerCodeRoutes);
app.use('/admin', adminRoutes);

// Home page
app.get('/', async (req, res) => {
  let html;
  try {
    html = await fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8');
  } catch (error) {
    console.error('Could not read the landing page:', error);
    return res.status(500).send('Could not load the landing page.');
  }

  let settings = { default_lead_source: 'Bengaluru - Varthur' };
  try {
    settings = await getMarketingSettings();
  } catch (error) {
    console.error('Could not load marketing tracking settings:', error);
  }

  const tags = [];
  const gtmId = /^GTM-[A-Z0-9]+$/i.test(settings.gtm_container_id || '') ? settings.gtm_container_id : '';
  const gaId = /^G-[A-Z0-9]+$/i.test(settings.ga_measurement_id || '') ? settings.ga_measurement_id : '';
  const clarityId = /^[A-Za-z0-9-]{1,64}$/.test(settings.clarity_project_id || '') ? settings.clarity_project_id : '';
  const searchConsoleToken = /^[A-Za-z0-9_-]{1,255}$/.test(settings.search_console_token || '') ? settings.search_console_token : '';
  const serializedSettings = JSON.stringify({
    defaultLeadSource: settings.default_lead_source || 'Bengaluru - Varthur'
  }).replace(/</g, '\\u003c');

  tags.push(`<script>window.FE_MARKETING_SETTINGS=${serializedSettings};</script>`);
  if (searchConsoleToken) {
    tags.push(`<meta name="google-site-verification" content="${searchConsoleToken}">`);
  }
  if (gtmId) {
    tags.push(`<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!=='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>`);
  }
  if (gaId) {
    tags.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>`);
  }
  if (clarityId) {
    tags.push(`<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script','${clarityId}');</script>`);
  }

  let activeSnippets = [];
  try {
    activeSnippets = await getHeaderCodeSnippetsForPublic();
  } catch (error) {
    console.error('Could not load active header code snippets:', error);
  }

  const snippetGroups = {
    HEAD: [],
    BODY_START: [],
    BODY_END: []
  };

  for (const snippet of activeSnippets) {
    if (!snippet || !snippet.code) continue;
    const content = String(snippet.code);
    let injectedMarkup = content;

    if (snippet.type === 'CSS') {
      injectedMarkup = `<style>${content}</style>`;
    } else if (snippet.type === 'JavaScript') {
      injectedMarkup = `<script>${content}\n</script>`;
    }

    const location = snippet.location || 'HEAD';
    if (snippetGroups[location]) {
      snippetGroups[location].push(injectedMarkup);
    }
  }

  const headMarker = '<!-- HEADER_CODE_SNIPPETS_HEAD -->';
  const bodyStartMarker = '<!-- HEADER_CODE_SNIPPETS_BODY_START -->';
  const bodyEndMarker = '<!-- HEADER_CODE_SNIPPETS_BODY_END -->';
  const marker = '<!-- MARKETING_SETTINGS -->';
  if (!html.includes(marker)) {
    console.error('Marketing settings insertion point is missing from public/index.html.');
    return res.status(500).send('Landing page tracking configuration is unavailable.');
  }

  let renderedHtml = html.replace(marker, `${tags.join('\n')}\n${headMarker}`);
  const inject = (source, markerText, markup, fallback) => {
    if (source.includes(markerText)) return source.replace(markerText, markup);
    return source.replace(fallback.pattern, match => fallback.replace(match, markup));
  };
  renderedHtml = inject(
    renderedHtml,
    headMarker,
    snippetGroups.HEAD.join('\n'),
    { pattern: /<\/head>/i, replace: (match, markup) => `${markup}\n${match}` }
  );
  renderedHtml = inject(
    renderedHtml,
    bodyStartMarker,
    snippetGroups.BODY_START.join('\n'),
    { pattern: /<body\b[^>]*>/i, replace: (match, markup) => `${match}\n${markup}` }
  );
  renderedHtml = inject(
    renderedHtml,
    bodyEndMarker,
    snippetGroups.BODY_END.join('\n'),
    { pattern: /<\/body>/i, replace: (match, markup) => `${markup}\n${match}` }
  );

  res.type('html').send(renderedHtml);
});

app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const PORT = process.env.PORT || 2001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});