/**
 * Allowed entity_type values for polymorphic attachment links.
 * Must match DB ENUM (see initSchema / migration).
 */
const ENTITY_TYPES = Object.freeze([
  'patient',
  'doctor',
  'appointment',
  'billing',
  'inventory',
  'medical_record'
]);

const MAX_DOCUMENT_TYPE_LEN = 100;
const MAX_TITLE_LEN = 150;
const MAX_DESCRIPTION_LEN = 65535; // TEXT

module.exports = {
  ENTITY_TYPES,
  MAX_DOCUMENT_TYPE_LEN,
  MAX_TITLE_LEN,
  MAX_DESCRIPTION_LEN
};
