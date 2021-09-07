const urlMetadata = require("url-metadata");
var Mixpanel = require('mixpanel');
var mixpanel = Mixpanel.init('7c2c2239897c7c2d76e501beb27ef81d');

module.exports = (app, passport, UserModel) => {

  // Home Page
  app.get("/", isNotLoggedIn, (req, res) => {
    res.render("home", {
      isAuth: req.isAuthenticated(),
      user: req.user
    });
  });

  // Login
  app.get("/login", isNotLoggedIn, (req, res) => res.render("login", {
    message: req.flash("loginMessage"),
    isAuth: req.isAuthenticated(),
    user: req.user
  }));

  app.post("/login", passport.authenticate("local-login", {
    successRedirect: "/bookmarks", // redirect to the secure profile section
    failureRedirect: "/login", // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }));

  // Signup
  // app.get("/signup", isNotLoggedIn, (req, res) => {
  //
  //   mixpanel.track('signup', {
  //     distinct_id: "__demo__?",
  //     signup: 1,
  //   });
  //
  //   res.render("signup", {
  //     usernameMessage: req.flash("usernameMessage"),
  //     emailMessage: req.flash('emailMessage'),
  //     passwordMessage: req.flash('passwordMessage'),
  //     passwordValid: req.flash('passwordValid'),
  //     isAuth: req.isAuthenticated(),
  //     user: req.user
  //   });
  //
  // });
  //
  // app.post("/signup", passport.authenticate("local-signup", {
  //   successRedirect: "/",
  //   failureRedirect: `/signup?betaToken=${process.env.SIGNUP_SECRET}`,
  //   failtureFlash: true
  // }));

  // Profile
  app.get("/profile", isLoggedIn, (req, res) => {
    let redirectUrl = `/user/${req.user.username}`;
    res.redirect(redirectUrl);
  });

  app.post("/profile", async (req, res) => {
    const email = req.user.email;
    const emailInput = req.body.email;
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    const emailExists = await UserModel.exists({ email: emailInput.toLowerCase() });
    if(!emailExists){
      if (user == null) {
        res.sendStatus(404);
      } else {
        user.name = req.body.name;
        user.email = req.body.email;
      }
      try {
        await user.save();
        res.redirect("/profile");
      } catch (err) {
        res.status(400);
      }
    }else{
      req.flash('changeMessage', "Sorry, that email is taken.")
      res.redirect('/profile');
    }
  });

  app.get("/user/:username", isLoggedIn, (req, res) => {
    let username = req.params.username;
    UserModel.findOne({
      username
    }, (err, doc) => {
      if (err) throw err;
      if (!doc)
        res.render("404", {
          isAuth: req.isAuthenticated(),
          user: req.user,
          profile: null,
        });
      else {
        res.render("profile", {
          isAuth: req.isAuthenticated(),
          user: req.user,
          profile: doc,
          isRoot: req.isAuthenticated() ? doc.username === req.user.username : false,
          changeMessage: req.flash('changeMessage')
        });
      }
    });

  });
  app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
  });

  //Bookmarks
  app.get("/bookmarks", isLoggedIn, (req, res) => {
    let redirectUrl = `/user/${req.user.username}/bookmarks`;
    res.redirect(redirectUrl);
  });

  app.post("/bookmarks", async (req, res) =>{
    const email = req.user.email;
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if(user == null ){
      res.sendStatus(404);
    }else{
      if(req.query.url == null){
        let url = req.body.url;
        const protocol = url.substring(0, req.body.url.indexOf(':'));
        if (protocol == "") {
          //Enables flexibility in url
          url = `http://${url}`;
        }
        if (validURL(removeQuery(url))){
          const metadata = await urlMetadata(url).then(
            (metadata) => {
              return {
                imgUrl: metadata.image,
                title: metadata.title,
                desc: metadata.description
              };
            },
            (error) => {
              console.log(error);
            }
          );

          mixpanel.track('Bookmark Added', {
            distinct_id: req.user.username,
            url: removeQuery(url),
            notes: (req.body.notes) ? 1 : 0,
          });

          if(metadata == undefined){
            user.bookmarks.push({
              url: removeQuery(url),
              notes: req.body.notes,
              imgUrl: '',
              title: removeQuery(url),
              desc: ''
            });
          }else{
            user.bookmarks.push({
              url: removeQuery(url),
              notes: req.body.notes,
              imgUrl: validURL(metadata.imgUrl) ? metadata.imgUrl : "",
              title: metadata.title,
              desc: metadata.desc
            });
          }
        }else{
          req.flash('addBookmark', "Sorry, that url is invalid.");
          res.redirect('/bookmarks');
        }
      }else{
        for(let i = 0; i < user.bookmarks.length; i++){
          if(user.bookmarks[i].url == req.query.url){
            user.bookmarks.splice(i, 1);
          }
        }
      }
      try{
        await user.save();
        res.redirect("/bookmarks");
      }catch(err){
        res.status(400);
      }
    }
  });

  app.post("/bookmarks/update", async (req, res) => {
    const email = req.user.email;
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (user == null) {
      res.sendStatus(404);
    } else {

      mixpanel.track('Bookmark Edited', {
        distinct_id: req.user._id,
        edit: 1,
      });

      for (let i = 0; i < user.bookmarks.length; i++) {
        if (user.bookmarks[i].url == req.query.url) {
          user.bookmarks.set(i, {
            url: user.bookmarks[i].url,
            notes: req.body.notes,
            imgUrl: user.bookmarks[i].imgUrl,
            title: req.body.title,
            desc: user.bookmarks[i].desc
          });
        }
      }
    }
    try {
      await user.save();
      res.redirect("/bookmarks");
    } catch (err) {
      res.status(400);
    }
  });

  app.get("/user/:username/bookmarks", isLoggedIn, (req, res) => {
    let username = req.params.username;


    UserModel.findOne({
      username
    }, (err, doc) => {
      if (err) throw err;
      if (!doc)
        res.render("404", {
          isAuth: req.isAuthenticated(),
          user: req.user,
          profile: null,
        });
      else {

        mixpanel.track('dashboard view', {
          distinct_id: req.user._id,
          view: 1,
        });

        res.render("bookmarks", {
          isAuth: req.isAuthenticated(),
          user: req.user,
          profile: doc,
          isRoot: req.isAuthenticated() ? doc.username === req.user.username : false,
          addBookmark: req.flash('addBookmark')
        });
      }
    });
  });

  //404 page
  app.get("*", (req, res) => {
    res.render("404", {
      isAuth: req.isAuthenticated(),
      user: req.user,
    });
  });
};

function checkBeta(req, res, next){
  if(req.query.betaToken === process.env.SIGNUP_SECRET){
    return next();
  }else{
    res.send({message: "Invalid url"}).redirect("/");
  }
}

function isLoggedIn(req, res, next) {
  // if user is authenticated in the session, carry on
  if (req.isAuthenticated())
    return next();
  // if they aren't redirect them to the home page
  res.redirect("/");
}

function isNotLoggedIn(req, res, next){
  if (!req.isAuthenticated())
    return next();
  // if they aren't redirect them to the home page
  res.redirect("/bookmarks");
}

const removeQuery = (link) => {
  if(link.indexOf("?") > 0){
    return link.substring(0, link.indexOf("?"));
  }else{
    return link;
  }
};

function validURL(myURL) {
  var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + //port
    '(\\?[;&amp;a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', 'i');
  return pattern.test(myURL);
}
