const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const db = require('../db-client');

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

const userInit = (privateKey) => {
    
  router.post('/login', async (req, res) => {
    try {
      console.log('/login =>', req.body);

      const userName = req.body.userName;
      const password = req.body.password;

      if (!userName || !password) {
        return res.status(400).json({
          text: 'Username and password are required!',
          token: null,
        });
      }

      const response = await db.readDocument({
        collection: 'User',
        query: JSON.stringify({ userName: userName }),
      });

      let user = { userName: '' };
      if (response) {
        const temp = JSON.parse(response.data);
        if (temp.length) {
          user = temp[0];
        }
      }

      if (user.userName === '') {
        return res.status(401).json({
          text: 'Username not found!',
          token: null,
        });
      }

      console.log('User ->', userName, user._id);

      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        const payload = {
          _id: user._id,
          userName: user.userName,
          userLevel: user.userLevel,
          userState: user.userState,
        };

        jwt.sign(payload, privateKey, {
          expiresIn: 60 * 60 * 24 * 1
        }, (err, token) => {
          if (err) {
            return res.status(500).json({
              text: 'There is some error in token!',
              token: null,
            });
          }

          let text = 'Login success!';
          if (user.userState === 'waiting') {
            text = 'Your account is not confirmed!';
          }

          return res.json({
            text: text,
            token: `Bearer ${token}`
          });
        });
      } else {
        return res.status(401).json({
          text: 'Username or password incorrect!',
          token: null,
        });
      }
    } catch (error) {
      console.error('Login Error:', error.message);
      return res.status(500).json({
        text: 'Server error during login',
        token: null,
      });
    }
  });

  router.get('/me', authMiddleware, (req, res) => {
    console.log('/me ->', req.user.userName);

    if (!req.user.text) {
      return res.json({
        _id: req.user._id,
        displayName: req.user.userLevel,
        userName: req.user.userName,
        email: req.user.email,
        text: '',
      });
    }

    return res.status(401).json({
      text: 'Token error!',
    });
  });
}

module.exports = {
  userInit: userInit,
  router: router,
}
