const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
require('dotenv').config();

const formRoutes = require('./routes/form');
const adminRoutes = require('./routes/admin');
const { getMarketingSettings } = require('./database/marketing-settings');
const { getHeaderCodeSnippetsForPublic } = require('./database/header-code-manager');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

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

  const activeSnippets = await getHeaderCodeSnippetsForPublic().catch(() => []);

  const snippetGroups = {
    HEAD: [],
    BODY_START: [],
    BODY_END: []
  };

  for (const snippet of activeSnippets) {
    if (!snippet || !snippet.code_content) continue;
    const content = String(snippet.code_content || '');
    let injectedMarkup = content;

    if (snippet.code_type === 'CSS') {
      injectedMarkup = `<style>${content}</style>`;
    } else if (snippet.code_type === 'JavaScript') {
      injectedMarkup = `<script>${content}\n</script>`;
    }

    const location = snippet.insertion_location || 'HEAD';
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
  renderedHtml = renderedHtml.replace(headMarker, `${snippetGroups.HEAD.join('\n')}\n${headMarker}`);
  renderedHtml = renderedHtml.replace(bodyStartMarker, `${snippetGroups.BODY_START.join('\n')}\n${bodyStartMarker}`);
  renderedHtml = renderedHtml.replace(bodyEndMarker, `${snippetGroups.BODY_END.join('\n')}\n${bodyEndMarker}`);

  if (!renderedHtml.includes(headMarker)) {
    renderedHtml = renderedHtml.replace('</head>', `${snippetGroups.HEAD.join('\n')}\n</head>`);
  }
  if (!renderedHtml.includes(bodyStartMarker)) {
    renderedHtml = renderedHtml.replace('<body', '<body');
  }
  if (!renderedHtml.includes(bodyEndMarker)) {
    renderedHtml = renderedHtml.replace('</body>', `${snippetGroups.BODY_END.join('\n')}\n</body>`);
  }

  renderedHtml = renderedHtml
    .replace(new RegExp(`${headMarker}`, 'g'), snippetGroups.HEAD.join('\n'))
    .replace(new RegExp(`${bodyStartMarker}`, 'g'), snippetGroups.BODY_START.join('\n'))
    .replace(new RegExp(`${bodyEndMarker}`, 'g'), snippetGroups.BODY_END.join('\n'));

  res.type('html').send(renderedHtml);
});

const PORT = process.env.PORT || 2001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});