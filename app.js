const express = require("express");
const app = express();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");

const userModel = require("./models/user.js");
const postModel = require("./models/post.js");
const path = require("path");
const upload = require("./config/multerconfig");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/register", async (req, res) => {
  let { username, name, email, password, age } = req.body;
  let user = await userModel.findOne({ email });
  if (user) return res.status(500).send("user alredy registered");

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      console.log(hash);
      let user = await userModel.create({
        username,
        name,
        email,
        password: hash,
        age,
      });

      let token = jwt.sign({ email: email, userid: user._id }, "mysecretkey");
      res.cookie("token", token);

      res.redirect("/login");
    });
  });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  let user = await userModel.findOne({ email });
  if (!user) return res.status(500).send("something went wrong");

  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: email, userid: user._id }, "mysecretkey");
      res.cookie("token", token);
      res.redirect("/profile");
    } else {
      res.redirect("/login");
    }
  });
});

// app.get("/logout", (req, res) => {
//   res.cookie("token", "");
//   res.redirect("/login");
// });

// Logout route - clears the token completely
app.get("/logout", (req, res) => {
  res.clearCookie("token"); // Completely remove the token
  res.redirect("/login");
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }).populate("posts");
  console.log(user);
  res.render("profile", { user });
});

app.get("/edit-profile", isLoggedIn, async (req, res) => {
  res.render("profileupload");
});

// app.post("/upload", isLoggedIn, upload.single("image"), async (req, res) => {
//   let user = await userModel.findOneAndUpdate({ email: req.user.email });
//   user.profilepic = req.file.filename;
//   await user.save();
//   res.redirect("/profile");
// });

app.post("/upload", isLoggedIn, upload.single("image"), async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }); // Use req.user
  if (!user) {
    return res.status(404).send("User not found");
  }

  // Update user profile picture with the uploaded filename
  user.profilepic = req.file.filename;
  await user.save();

  res.redirect("/profile");
});

app.get("/allposts", isLoggedIn, async (req, res) => {
  let posts = await postModel.find().populate("user");
  let userid = req.user.userid;
  res.render("allposts", { posts, userid });
});

app.post("/post", isLoggedIn, async (req, res) => {
  let { content } = req.body;
  let user = await userModel.findOne({ email: req.user.email });
  let post = await postModel.create({
    user: user._id,
    content,
  });

  user.posts.push(post._id);
  await user.save();

  res.redirect("/profile");
});

app.get("/likefromprofile/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id });
  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }
  await post.save();

  res.redirect("/profile");
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id });
  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }
  await post.save();

  res.redirect("/allposts");
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id });
  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content }
  );
  res.redirect("/profile");
});

//middleware for protected pages
// function isLoggedIn(req, res, next) {
//   if (req.cookies.token === "") res.send("You must be logged in");
//   else {
//     let data = jwt.verify(req.cookies.token, "mysecretkey");
//     //add a field user in the request before forwarding the user to the page, so that the user is identified.
//     req.user = data;
//   }
//   next();
// }

function isLoggedIn(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send("You must be logged in");
  }

  try {
    // Verify and decode token
    const data = jwt.verify(token, "mysecretkey");
    req.user = data; // Attach user data from token to the request object
    next();
  } catch (error) {
    // If token is invalid, redirect to login or send error
    res.clearCookie("token"); // Clear invalid token
    return res.status(401).send("Invalid session, please log in again");
  }
}

app.listen(3000);
