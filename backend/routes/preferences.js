const express = require('express');
const router = express.Router();
const passport = require('passport');
const db = require('../db-client');
const { executeScript } = require('../libs/scriptRunner');

/**
 * Middleware to handle authentication errors and return JSON
 */
const authMiddleware = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  })(req, res, next);
};

function restInit(
  readcfg, 
  createPassword,
)  {

  let cfg = readcfg(false)

  router.get('/getConfig', function(req, res) {    
    cfg = readcfg(false)
    return res.json(cfg);
  });

  router.post('/createDocument', authMiddleware, async function(req, res) {
    try {
      console.log('/createDocument ->', req.body);

      if (req.body.data.password) {
        req.body.data.password = await createPassword(req.body.data.password);
      }

      const response = await db.createDocument({
        collection: req.body.collection,
        data: JSON.stringify(req.body.data),
      });

      const data = JSON.parse(response.data);
      return res.json(data);
    } catch (error) {
      console.error('Create Document Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/readDocument', authMiddleware, async function(req, res) {
    try {
      console.log('/readDocument ->', req.body);

      const response = await db.readDocument({
        collection: req.body.collection,
        query: JSON.stringify(req.body.query),
      });

      const data = JSON.parse(response.data);
      return res.json(data);
    } catch (error) {
      console.error('Read Document Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });
    
  router.post('/updateDocument', authMiddleware, async function(req, res) {
    try {
      console.log('/updateDocument ->', req.body);

      if (req.body.collection === 'User') {
        if (req.body.data.password && req.body.data.password !== '') {
          if (!req.body.data.password.startsWith('$2')) {
            req.body.data.password = await createPassword(req.body.data.password);
          }
        } else {
          delete req.body.data.password;
        }
      }

      const response = await db.updateDocument({
        collection: req.body.collection,
        query: JSON.stringify({ _id: req.body.data._id }),
        data: JSON.stringify(req.body.data),
      });

      const data = JSON.parse(response.data);
      return res.json(data);
    } catch (error) {
      console.error('Update Document Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/deleteDocument', authMiddleware, async function(req, res) {
    try {
      console.log('/deleteDocument ->', req.body);

      const response = await db.deleteDocument({
        collection: req.body.collection,
        query: JSON.stringify(req.body.query),
      });

      const data = JSON.parse(response.data);
      return res.json(data);
    } catch (error) {
      console.error('Delete Document Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/dropDatabase', authMiddleware, async function(req, res) {
    try {
      console.log('/dropDatabase ->', req.body);
      await db.dropDatabase(req.body);
      return res.json({ status: true });
    } catch (error) {
      console.error('Drop Database Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/dropCollection', authMiddleware, async function(req, res) {
    try {
      console.log('/dropCollection ->', req.body);
      await db.dropCollection(req.body);
      return res.json({ status: true });
    } catch (error) {
      console.error('Drop Collection Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // New endpoint for executing scripts
  router.post('/executeScript', authMiddleware, async function(req, res) {
    try {
      console.log('/executeScript ->', req.body);
      
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Code is required' });
      }

      const result = await executeScript(code);
      return res.json(result);
    } catch (error) {
      console.error('Execute Script Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

}

module.exports = {
  restInit: restInit,
  router: router,
};