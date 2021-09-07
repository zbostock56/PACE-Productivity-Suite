const LocalStategy = require("passport-local").Strategy;

const User = require("../models/user.model");

module.exports = passport => {
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
  });

  // Signup
  passport.use("local-signup", new LocalStategy({
    passReqToCallback: true
  }, async (req, username, password, done) => {
    const usernameInput = username.toLowerCase();
    const emailInput = req.body.email;
    const usernameExists = await User.exists({ username_lower: usernameInput });
    const emailExists = await User.exists({ email: emailInput });
    const passwordValid = password.length > 8;
    const passwordsDifferent = password != req.body.rePassword;
    if(!passwordValid){
      req.flash("passwordValid", "This password does not meet the criteria, try again.");
    }
    if(usernameExists){
      req.flash("usernameMessage", "Sorry, that username is taken.");
    }
    if(emailExists){
      req.flash("emailMessage", "Sorry, that email is taken.");
    }
    if(passwordsDifferent){
      req.flash("passwordMessage", "Looks like the passwords were different, try again.");
    }
    if(usernameExists || emailExists || passwordsDifferent || !passwordValid){
      return done(null, false);
    }else{
      let newUser = new User({
        username: username,
        username_lower: username.toLowerCase(),
        name: req.body.name,
        email: req.body.email.toLowerCase()
      });
      newUser.password = newUser.generateHash(password);
      newUser.save(err => {
        if (err) throw err;
        return done(null, newUser);
      });
    }
  }));

  // Login
  passport.use("local-login", new LocalStategy({
    passReqToCallback: true
  }, (req, identifier, password, done) => {
    User.findOne({ $or: [ {'username_lower': identifier.toLowerCase()}, {'email': identifier.toLowerCase()} ] }, (err, user) => {
      if (err) throw err;
      // req.flash is the way to set flashdata using connect-flash
      if (!user)
        return done(null, false, req.flash("loginMessage", "No user found."));
      if (!user.validatePassword(password))
        return done(null, false, req.flash("loginMessage", "Oops! Wrong password.")); // create the loginMessage and save it to session as flashdata

      // all is well, return successful user
      return done(null, user);
    });
  }));
};