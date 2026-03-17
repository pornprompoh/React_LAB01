const JWTStrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;
const db = require('../db-client');

const opts = {};
opts.jwtFromRequest = ExtractJWT.fromAuthHeaderAsBearerToken();

module.exports = (
  passport, 
  privateKey,  
) => {

  opts.secretOrKey = privateKey;

  passport.use(new JWTStrategy(opts, async (jwt_payload, cb) => {
    try {
      console.log('passport ->', jwt_payload.userName);

      const response = await db.readDocument({
        collection: 'User',
        query: JSON.stringify({ userName: jwt_payload.userName }),
      });

      let user = null;

      if (response) {
        const temp = JSON.parse(response.data);
        if (temp.length) {
          user = temp[0];
        }

        if (user) {
          return cb(null, user);
        } else {
          return cb(null, {
            text: 'User token error!',
          });
        }
      } else {
        console.error('❌ User database connection error!');
        return cb(null, {
          text: 'User database connection error!',
        });
      }
    } catch (error) {
      console.error('❌ Passport Error:', error.message);
      return cb(null, {
        text: 'Passport authentication error!',
      });
    }
  }));
}