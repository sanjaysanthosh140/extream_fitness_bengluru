const db = require('../db');

const CODE_TYPES = ['HTML', 'CSS', 'JavaScript'];
const INSERTION_LOCATIONS = ['HEAD', 'BODY_START', 'BODY_END'];
const MAX_CODE_LENGTH = 100000;

function normalizeSnippetInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const active = input.active !== undefined ? input.active : input.is_active;
  return {
    name: String(input.name || '').trim(),
    type: String(input.type || input.code_type || '').trim(),
    location: String(input.location || input.insertion_location || '').trim(),
    code: typeof input.code === 'string'
      ? input.code
      : typeof input.code_content === 'string' ? input.code_content : '',
    description: String(input.description || '').trim(),
    active: active === true || active === 1 || active === '1' || active === 'true'
  };
}

function validateHeaderCodeSnippetInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const snippet = normalizeSnippetInput(input);
  const errors = {};

  if (!snippet.name) {
    errors.name = 'Code name is required.';
  } else if (snippet.name.length > 255) {
    errors.name = 'Code name must be 255 characters or fewer.';
  }

  if (!CODE_TYPES.includes(snippet.type)) {
    errors.type = 'Code type must be HTML, CSS or JavaScript.';
  }

  if (!INSERTION_LOCATIONS.includes(snippet.location)) {
    errors.location = 'Insertion location must be HEAD, BODY_START or BODY_END.';
  }

  if (!snippet.code.trim()) {
    errors.code = 'Code content is required.';
  } else if (snippet.code.length > MAX_CODE_LENGTH) {
    errors.code = `Code content must be ${MAX_CODE_LENGTH.toLocaleString()} characters or fewer.`;
  }

  if (snippet.description.length > 255) {
    errors.description = 'Description must be 255 characters or fewer.';
  }

  const active = input.active !== undefined ? input.active : input.is_active;
  if (active !== undefined && ![true, false, 1, 0, '1', '0', 'true', 'false'].includes(active)) {
    errors.active = 'Status must be active or inactive.';
  }

  return { snippet, errors, valid: Object.keys(errors).length === 0 };
}

function normalizeId(id) {
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

async function getHeaderCodeSnippetById(id) {
  const snippetId = normalizeId(id);
  if (snippetId === null) return null;

  const [rows] = await db.execute(
    `SELECT id, name, \`type\`, location, code, description, \`active\`, updated_at
     FROM header_code_snippets WHERE id = ?`,
    [snippetId]
  );
  return rows[0] || null;
}

async function listHeaderCodeSnippets() {
  const [rows] = await db.execute(
    `SELECT id, name, \`type\`, location, code, description, \`active\`, updated_at
     FROM header_code_snippets
     ORDER BY updated_at DESC, id DESC`
  );
  return rows;
}

async function getHeaderCodeSnippetsForPublic() {
  const [rows] = await db.execute(
    `SELECT \`type\`, location, code
     FROM header_code_snippets
     WHERE \`active\` = 1
     ORDER BY FIELD(location, 'HEAD', 'BODY_START', 'BODY_END'), updated_at DESC, id DESC`
  );
  return rows;
}

async function createHeaderCodeSnippet(payload) {
  const { snippet, errors, valid } = validateHeaderCodeSnippetInput(payload);
  if (!valid) {
    const error = new Error('Invalid header code snippet data');
    error.errors = errors;
    throw error;
  }

  const [result] = await db.execute(
    `INSERT INTO header_code_snippets (name, \`type\`, location, code, description, \`active\`, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [snippet.name, snippet.type, snippet.location, snippet.code, snippet.description, snippet.active ? 1 : 0]
  );
  return getHeaderCodeSnippetById(result.insertId);
}

async function updateHeaderCodeSnippet(id, payload) {
  payload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const snippetId = normalizeId(id);
  const existing = snippetId === null ? null : await getHeaderCodeSnippetById(snippetId);
  if (!existing) {
    const error = new Error('Header code snippet not found');
    error.statusCode = 404;
    throw error;
  }

  const { snippet, errors, valid } = validateHeaderCodeSnippetInput({
    ...existing,
    ...payload,
    active: payload.active !== undefined ? payload.active : existing.active
  });
  if (!valid) {
    const error = new Error('Invalid header code snippet data');
    error.errors = errors;
    throw error;
  }

  await db.execute(
    `UPDATE header_code_snippets
     SET name = ?, \`type\` = ?, location = ?, code = ?, description = ?,
         \`active\` = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      snippet.name,
      snippet.type,
      snippet.location,
      snippet.code,
      snippet.description,
      snippet.active ? 1 : 0,
      snippetId
    ]
  );
  return getHeaderCodeSnippetById(snippetId);
}

async function deleteHeaderCodeSnippet(id) {
  const snippetId = normalizeId(id);
  if (snippetId === null) {
    const error = new Error('Header code snippet not found');
    error.statusCode = 404;
    throw error;
  }

  const [result] = await db.execute(
    'DELETE FROM header_code_snippets WHERE id = ?',
    [snippetId]
  );
  if (!result.affectedRows) {
    const error = new Error('Header code snippet not found');
    error.statusCode = 404;
    throw error;
  }
}

async function toggleHeaderCodeSnippetStatus(id, active) {
  const snippetId = normalizeId(id);
  if (snippetId === null) {
    const error = new Error('Header code snippet not found');
    error.statusCode = 404;
    throw error;
  }

  const existing = await getHeaderCodeSnippetById(snippetId);
  if (!existing) {
    const error = new Error('Header code snippet not found');
    error.statusCode = 404;
    throw error;
  }

  await db.execute(
    'UPDATE header_code_snippets SET `active` = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [active ? 1 : 0, snippetId]
  );
  return getHeaderCodeSnippetById(snippetId);
}

module.exports = {
  validateHeaderCodeSnippetInput,
  listHeaderCodeSnippets,
  getHeaderCodeSnippetById,
  getHeaderCodeSnippetsForPublic,
  createHeaderCodeSnippet,
  updateHeaderCodeSnippet,
  deleteHeaderCodeSnippet,
  toggleHeaderCodeSnippetStatus
};
