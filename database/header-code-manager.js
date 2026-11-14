const db = require('../db');

let headerCodeTableReady;

function normalizeCodeType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const map = {
    html: 'HTML',
    css: 'CSS',
    javascript: 'JavaScript',
    js: 'JavaScript'
  };
  return map[raw] || raw.toUpperCase();
}

function normalizeInsertionLocation(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const map = {
    head: 'HEAD',
    'body start': 'BODY_START',
    'body_start': 'BODY_START',
    bodystart: 'BODY_START',
    body_start: 'BODY_START',
    'body end': 'BODY_END',
    body_end: 'BODY_END',
    bodyend: 'BODY_END',
    end: 'BODY_END'
  };
  return map[raw] || raw.replace(/\s+/g, '_').toUpperCase();
}

function normalizeSnippetInput(input = {}) {
  return {
    name: String(input.name || input.code_name || '').trim(),
    description: String(input.description || '').trim(),
    codeType: normalizeCodeType(input.code_type || input.codeType),
    insertionLocation: normalizeInsertionLocation(input.insertion_location || input.insertionLocation || input.location),
    codeContent: String(input.code_content || input.codeContent || '').trim(),
    isActive: input.is_active !== undefined ? Boolean(Number(input.is_active)) : Boolean(input.isActive)
  };
}

async function ensureHeaderCodeTable() {
  if (!headerCodeTableReady) {
    headerCodeTableReady = db.execute(`
      CREATE TABLE IF NOT EXISTS header_code_snippets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(255) NOT NULL DEFAULT '',
        code_type ENUM('HTML', 'CSS', 'JavaScript') NOT NULL,
        insertion_location ENUM('HEAD', 'BODY_START', 'BODY_END') NOT NULL,
        code_content LONGTEXT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `).then(() => undefined).catch((error) => {
      headerCodeTableReady = null;
      throw error;
    });
  }

  await headerCodeTableReady;
}

function validateSnippetInput(input = {}) {
  const normalized = normalizeSnippetInput(input);
  const errors = {};

  if (!normalized.name) {
    errors.name = 'Code name is required.';
  }

  if (!['HTML', 'CSS', 'JavaScript'].includes(normalized.codeType)) {
    errors.codeType = 'Code type must be HTML, CSS or JavaScript.';
  }

  if (!['HEAD', 'BODY_START', 'BODY_END'].includes(normalized.insertionLocation)) {
    errors.insertionLocation = 'Insertion location must be HEAD, BODY_START or BODY_END.';
  }

  if (!normalized.codeContent) {
    errors.codeContent = 'Code content is required.';
  }

  if (normalized.codeContent.length > 100000) {
    errors.codeContent = 'Code content must be 100,000 characters or fewer.';
  }

  return {
    normalized,
    errors,
    valid: Object.keys(errors).length === 0
  };
}

async function listHeaderCodeSnippets() {
  await ensureHeaderCodeTable();
  const [rows] = await db.execute(`
    SELECT * FROM header_code_snippets
    ORDER BY updated_at DESC, id DESC
  `);
  return rows;
}

async function getHeaderCodeSnippetById(id) {
  await ensureHeaderCodeTable();
  const [rows] = await db.execute(`
    SELECT * FROM header_code_snippets WHERE id = ?
  `, [id]);
  return rows[0] || null;
}

async function getHeaderCodeSnippetsForPublic() {
  await ensureHeaderCodeTable();
  const [rows] = await db.execute(`
    SELECT * FROM header_code_snippets
    WHERE is_active = 1
    ORDER BY FIELD(insertion_location, 'HEAD', 'BODY_START', 'BODY_END'), updated_at DESC, id DESC
  `);
  return rows;
}

async function createHeaderCodeSnippet(payload) {
  await ensureHeaderCodeTable();
  const validation = validateSnippetInput(payload);
  if (!validation.valid) {
    const error = new Error('Invalid header code snippet data');
    error.errors = validation.errors;
    throw error;
  }

  const snippet = validation.normalized;
  const description = (payload.description || '').trim();
  const [result] = await db.execute(`
    INSERT INTO header_code_snippets (name, description, code_type, insertion_location, code_content, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [snippet.name, description, snippet.codeType, snippet.insertionLocation, snippet.codeContent, snippet.isActive ? 1 : 0]);

  return getHeaderCodeSnippetById(result.insertId);
}

async function updateHeaderCodeSnippet(id, payload) {
  await ensureHeaderCodeTable();
  const existingSnippet = await getHeaderCodeSnippetById(id);
  if (!existingSnippet) {
    const error = new Error('Header code snippet not found');
    error.statusCode = 404;
    throw error;
  }

  const validation = validateSnippetInput({
    ...existingSnippet,
    ...payload,
    id
  });
  if (!validation.valid) {
    const error = new Error('Invalid header code snippet data');
    error.errors = validation.errors;
    throw error;
  }

  const snippet = validation.normalized;
  const description = (payload.description || '').trim();

  await db.execute(`
    UPDATE header_code_snippets
    SET name = ?, description = ?, code_type = ?, insertion_location = ?, code_content = ?, is_active = ?
    WHERE id = ?
  `, [snippet.name, description, snippet.codeType, snippet.insertionLocation, snippet.codeContent, snippet.isActive ? 1 : 0, id]);

  return getHeaderCodeSnippetById(id);
}

async function deleteHeaderCodeSnippet(id) {
  await ensureHeaderCodeTable();
  const existingSnippet = await getHeaderCodeSnippetById(id);
  if (!existingSnippet) {
    const error = new Error('Header code snippet not found');
    error.statusCode = 404;
    throw error;
  }

  const [result] = await db.execute(`DELETE FROM header_code_snippets WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function toggleHeaderCodeSnippetStatus(id) {
  await ensureHeaderCodeTable();
  const snippet = await getHeaderCodeSnippetById(id);
  if (!snippet) {
    const error = new Error('Header code snippet not found');
    error.statusCode = 404;
    throw error;
  }

  const nextStatus = snippet.is_active ? 0 : 1;
  await db.execute('UPDATE header_code_snippets SET is_active = ? WHERE id = ?', [nextStatus, id]);
  return getHeaderCodeSnippetById(id);
}

module.exports = {
  ensureHeaderCodeTable,
  validateHeaderCodeSnippetInput: validateSnippetInput,
  listHeaderCodeSnippets,
  getHeaderCodeSnippetById,
  getHeaderCodeSnippetsForPublic,
  createHeaderCodeSnippet,
  updateHeaderCodeSnippet,
  deleteHeaderCodeSnippet,
  toggleHeaderCodeSnippetStatus,
  normalizeSnippetInput
};
