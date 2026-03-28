const {
  getActiveOrganisation,
  saveOrganisation
} = require('../repositories/mysqlOrganisationRepository');

function defaultOrganisation() {
  return {
    code: 'DENTAL_CLINIC',
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    addSeal: false,
    logo: '',
    headerImage: '',
    footerImage: '',
    sealImage: ''
  };
}

async function getOrganisation(req, res, next) {
  try {
    const organisation = (await getActiveOrganisation()) || defaultOrganisation();
    return res.json({ organisation });
  } catch (err) {
    return next(err);
  }
}

async function updateOrganisation(req, res, next) {
  try {
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const payload = req.body || {};
    const organisation = await saveOrganisation(payload, actorId);
    return res.json({
      message: 'Organisation settings saved successfully',
      organisation: organisation || defaultOrganisation()
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getOrganisation,
  updateOrganisation
};
