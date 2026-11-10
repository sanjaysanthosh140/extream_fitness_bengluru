const db = require('../db');

let tableReady;

async function ensureMarketingSettingsTable() {
  if (!tableReady) {
    tableReady = db.execute(`
      CREATE TABLE IF NOT EXISTS marketing_settings (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        gtm_container_id VARCHAR(32) NOT NULL DEFAULT '',
        ga_measurement_id VARCHAR(32) NOT NULL DEFAULT '',
        search_console_token VARCHAR(255) NOT NULL DEFAULT '',
        clarity_project_id VARCHAR(64) NOT NULL DEFAULT '',
        default_lead_source VARCHAR(100) NOT NULL DEFAULT 'Bengaluru - Varthur',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `).then(() => db.execute(`
      INSERT IGNORE INTO marketing_settings (id) VALUES (1)
    `)).catch(error => {
      tableReady = null;
      throw error;
    });
  }

  await tableReady;
}

async function getMarketingSettings() {
  await ensureMarketingSettingsTable();
  const [rows] = await db.execute(
    `SELECT gtm_container_id, ga_measurement_id, search_console_token,
            clarity_project_id, default_lead_source
     FROM marketing_settings WHERE id = 1`
  );
  return rows[0];
}

async function saveMarketingSettings(settings) {
  await ensureMarketingSettingsTable();
  await db.execute(
    `UPDATE marketing_settings
     SET gtm_container_id = ?, ga_measurement_id = ?, search_console_token = ?,
         clarity_project_id = ?, default_lead_source = ?
     WHERE id = 1`,
    [
      settings.gtmContainerId,
      settings.gaMeasurementId,
      settings.searchConsoleToken,
      settings.clarityProjectId,
      settings.defaultLeadSource
    ]
  );
}

module.exports = {
  getMarketingSettings,
  saveMarketingSettings
};
