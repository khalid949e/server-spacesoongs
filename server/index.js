import express from "express";
import mongoose from "mongoose";
// import CLIENTID  from "./config.js";
import cors from "cors";
import multer from "multer";
import path from "path";
import admindata from "./modules/admins.js";
import bcrypt from "bcrypt";
import spacetoondb from "./routers/spacetoondata.js";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import usersdata from "./modules/users.js";
import Favorites from "./routers/favorites.js";
import usergoogle from "./modules/google.js";
import { error, profile } from "console";
// ---------------google-imports
import session from "express-session";
import passport from "passport";
import Outhstratigie from "passport-google-oauth2";
import { clientSecret } from "firebase-tools/lib/api.js";
Outhstratigie.Strategy;
const clientId = process.env.CLIENTID;
const clientsecret = process.env.CLIENTSECRET;
// ---------------google-imports

const app = express();
const port = 3000;
mongoose.connect(process.env.CONECT_LINK);
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

//   ---------------------------------------
app.use(spacetoondb);
// --------------=======------------------

// ------------------------admins------------------------------>
// app.post("/admin", async (req, res) => {
//   const { username, password } = req.body;
//   const uname = await admindata.findOne({ username });
//   if (uname) {
//     return res.send("user is alrady exist ");
//   }
//   const hashedps = bcrypt.hashSync(password, 10);
//   const newadmin = new admindata({
//     username: username,
//     password: hashedps,
//   });
//   await newadmin.save();
//   res.json(newadmin);
// });
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(401).json({ error: "all fealds must be filled" });
  }
  try {
    const pass = await admindata.findOne({ username });
    // !pass && res.json({message:"is not exist"})
    if (!pass) {
      return res.status(401).json({ error: "username or password incorrect" });
    }
    const isexist = await bcrypt.compare(password, pass.password);
    // !isexist && res.json({message:"username or password incorrect"})
    if (!isexist) {
      return res.status(401).json({ error: "username or password incorrect" });
    }
    const token = jwt.sign({ _id: pass._id }, process.env.SECRET);
    res.json({ token, adminId: pass._id });
  } catch (err) {
    res.status(404).json("I dont have that");
    console.log(err);
  }
});

// --------------// ---------------------------------Users------------------------------------
app.post(
  "/users",
  [
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/\d/)
      .withMessage("Password must contain a number")
      .matches(/[a-z]/)
      .withMessage("Password must contain a lowercase letter"),
  ],
  async (req, res) => {
    //    if (!username || !password) {
    //   return res.status(401).json({ error: "all fealds must be filled" });

    // }
    const { username, password } = req.body;
    const uname = await usersdata.findOne({ username });
    try {
      if (uname) {
        return res
          .status(401)
          .json({ errors: [{ msg: "user is alrady exist " }] });
      }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(401).json({ errors: errors.array() });
      }

      const hashedps = bcrypt.hashSync(password, 10);
      const newadmin = new usersdata({
        username: username,
        password: hashedps,
      });
      await newadmin.save();
      return res.status(200).json({ message: "regestred successfuly" });
    } catch (err) {
      console.log(err);
      return res.status(401).json({ error: "somthing wrong" });
    }
  }
);
app.post("/logusers", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(401).json({ error: "all fealds must be filled" });
  }
  try {
    const pass = await usersdata.findOne({ username });
    // !pass && res.json({message:"is not exist"})
    if (!pass) {
      return res.status(401).json({ error: "username or password incorrect" });
    }
    const isexist = await bcrypt.compare(password, pass.password);
    // !isexist && res.json({message:"username or password incorrect"})
    if (!isexist) {
      return res.status(401).send({ error: "username or password incorrect" });
    }
    const token = jwt.sign({ _id: pass._id }, process.env.SECRET);
    res.json({ token, adminId: pass._id });
  } catch (err) {
    res.status(404).json("I dont have that");
    console.log(err);
  }
  // ---------------headers---------------------
  app.get("/logusers", async (req, res) => {
    try {
      const user = await usersdata.findById(req.user.id);
      res.status(200).json(user.username);
    } catch (error) {
      res.status(400).send("Invalid token");
    }
  });
});

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "POST , GET , PUT , DELETE",
    credentials: true,
  })
);

// --------------------google---------------------->

app.use(
  session({
    secret: process.env.SESSIONSECRET,
    resave: false,
    // saveUnitialized :"true"
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new Outhstratigie(
    {
      clientID: clientId,
      clientSecret: clientsecret,
      callbackURL: "/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await usergoogle.findOne({ googleId: profile.id });
        if (!user) {
          user = new usergoogle({
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0].value,
            image: profile.photos[0].value,
          });
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: `http://localhost:5173/`,
    failureRedirect: `http://localhost:5173/login`,
  })
);
let userid = "";
app.get("/login/success", async (req, res) => {
  try {
    // console.log(req.user)
    userid = req.user;
    res.status(200).json(req.user);
  } catch (err) {
    res.status(401).json({ message: "failed to send user data" });

    console.log(err);
  }
});
app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect(`http://localhost:5173/`);
  });
});
// app.use(googlefav)
import fav from "./modules/favgoogle.js";
app.post("/favorites2", async (req, res) => {
  try {
    // const user_id = req.user._id;
    const { name } = req.body;
    const tit = await fav.findOne({ title: name, user_id: userid._id });

    if (tit) {
      return res.status(401).json({ message: " card alredy exist" });
    }
    const newcard = new fav({
      title: req.body.name,
      user_id: userid._id,
      imgname: req.body.image,
      audsrc: req.body.audio,
    });

    await newcard.save();
    res.status(200).json({ message: "song safed successfuly" });
  } catch (err) {
    res.status(401).json({ message: " This option requires login !!" });
    console.log(err);
  }
});

app.get("/chousedfav2", async (req, res) => {
  try {
    const userrid = userid._id;
    const chousedcard = await fav.find({ user_id: userrid });
    res.json(chousedcard);
  } catch (err) {
    res.status(401).send("not ok");
    console.log(err);
  }
});
app.delete("/deletecard2/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await fav.findByIdAndDelete(id);
    res.status(200).json({ message: "song has been deleted" });
  } catch (err) {
    console.log(err);
    res.status(401).json({ message: "song does not deleted" });
  }
});
app.get("/api/itemsfavgoogle/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const card = await fav.findById(id);
    res.status(200).json(card);
  } catch (err) {
    console.log(err);
    res.status(401).json({ message: "data dosnt send" });
  }
});

// --------------------google---------------------->
app.use(Favorites);
app.listen(port, () => {
  console.log("server started on port 3000");
});