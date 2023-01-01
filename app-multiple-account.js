var createError = require("http-errors");
var session = require("express-session");
//var flash = require("express-flash");
var logger = require("morgan");
var path = require("path");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var db = require("./database");
const { Client, MessageMedia, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const socketIO = require("socket.io");
const qrcode = require("qrcode");
const http = require("http");
const fs = require("fs");

const { phoneNumberFormatter } = require("./helpers/formatter");
const fileUpload = require("express-fileupload");
const axios = require("axios");
const port = process.env.PORT || 8000;
const router = express.Router();
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const hostname = "whatsapp-api.contentwithintent.org/";

//app.set("view engine", "ejs");
app.use(logger("dev"));
app.use(express.static(path.join(__dirname, "public")));
//app.use(flash());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.static("public"));
/**
 * BASED ON MANY QUESTIONS
 * Actually ready mentioned on the tutorials
 *
 * The two middlewares above only handle for data json & urlencode (x-www-form-urlencoded)
 * So, we need to add extra middleware to handle form-data
 * Here we can use express-fileupload
 */
app.use(
  fileUpload({
    debug: false,
  })
);

// app.get("/", (req, res) => {
//   res.sendFile("index-multiple-account.html", {
//     root: __dirname,
//   });
// });
// router.get("/instances", function (req, res) {
//   res.sendFile(path.join(__dirname + "/instances.html"));
// });
// app.get("/", (req, res) => {
//   res.sendFile(__dirname + "/instances.html");
// });
// app.get("/", (req, res) => {
//   res.sendFile(__dirname + "/index.html");
// });

app.get("/public/", (req, res) => {
  res.sendFile("instances.html", {
    root: __dirname,
  });
});
app.get("/refresh", function (req, res) {
  res.send();
  process.exit(0);
});

// app.get("/instances.html:id", function (req, res) {
//   //res.send("id: " + req.params.id);
//   res.send(`<h1>${req.params.id}</h1>`);
//   console.log("param" + req.params.id);
// });
app.get("/get_instance", function (req, res, next) {
  db.query(
    "SELECT * FROM tblInstance ORDER BY intInstanceCode desc",
    function (err, rows) {
      //console.log(row);
      if (err) {
        return res.status(500).json([
          {
            message: err,
          },
        ]);
      } else {
        return res.status(200).json([
          {
            rows,
          },
        ]);
      }
    }
  );
db.release();
});

app.get("/get_MobileNo", function (req, res, next) {
  const id = req.query.id;

  db.query(
    `SELECT intInstanceCode, strName, strMobileNo, boolisready  FROM tblInstance WHERE intInstanceCode=${id}`,
    function (err, rows) {
      //console.log(row);
      if (err) {
        return res.status(500).json([
          {
            message: err,
          },
        ]);
      } else {
        return res.status(200).json([
          {
            rows,
          },
        ]);
      }
    }
  );
});

app.post("/post_instance", function (req, res, next) {
  //var strSession = req.body.strSession;

  var sql = `INSERT INTO tblInstance (dtCreatedAt) VALUES (NOW())`;
  db.query(sql, function (err, result) {
    if (err) {
      return res.status(500).json([
        {
          message: err,
        },
      ]);
    } else {
      return res.status(200).json([
        {
          id: result.insertId,
          message: "Row inserted successfully!",
        },
      ]);
    }
    // res.json([
    //   {
    //     id: result.insertId,
    //     message: req.body.designation,
    //   },
    // ]);
    //req.flash("success", "Data stored!");
    res.redirect("/");
  });
});
// app.use(function (req, res, next) {
//   next(createError(404));
// });
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.json({ error: err });
});

const sessions = [];
const SESSIONS_FILE = "./whatsapp-sessions.json";

const createSessionsFileIfNotExists = function () {
  console.log("initiate 56");
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log("Sessions file created successfully.");
    } catch (err) {
      console.log("Failed to create sessions file: ", err);
    }
  }
};

createSessionsFileIfNotExists();

const setSessionsFile = function (sessions) {
  console.log("initiate 70");
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
    if (err) {
      console.log(err);
    }
  });
};

const getSessionsFile = function () {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
};

const createSession = function (id, description) {
  console.log("initiate 83");
  console.log("Creating session: " + id);
  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // <- this one doesn't works in Windows
        "--disable-gpu",
      ],
    },
    authStrategy: new LocalAuth({
      clientId: id,
    }),
  });

  client.initialize();
  client.on("qr", (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
      io.emit("qr", { id: id, src: url });

      io.emit("message", { id: id, text: "QR Code received, scan please!" });
    });
  });

  client.on("ready", () => {
    console.log(id);
    io.emit("ready", { id: id });
    io.emit("message", { id: id, text: "Whatsapp is ready!" });
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
    var sql = `UPDATE tblInstance SET strName='${client.info.pushname}', strMobileNo='${client.info.wid.user}',boolIsReady='true' WHERE intInstanceCode=${id}`;
    db.query(sql, function (err, result) {
      if (err) {
      } else {
      }
    });
  });

  client.on("authenticated", () => {
    console.log("id 124", id);
    io.emit("authenticated", { id: id });
    io.emit("message", { id: id, text: "Whatsapp is authenticated!" });
    console.log("AUTHENTICATED");
  });

  client.on("auth_failure", function () {
    console.log("id 130", id);
    io.emit("message", { id: id, text: "Auth failure, restarting..." });
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    savedSessions[sessionIndex].ready = false;
    setSessionsFile(savedSessions);

    io.emit("remove-session", id);
  });

  client.on("disconnected", (reason) => {
    console.log("id 135", id);
    io.emit("message", { id: id, text: "Whatsapp is disconnected!" });
    client.destroy();
    client.initialize();
    // const savedSessions = getSessionsFile();
    // const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    // savedSessions.splice(sessionIndex, 1);
    // setSessionsFile(savedSessions);

    // io.emit("remove-session", id);
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit("remove-session", id);
    console.log("multiple js");
    var sql = `UPDATE tblInstance SET boolIsReady='false' WHERE intInstanceCode=${id}`;

    db.query(sql, function (err, result) {
      if (err) {
        console.log(err);
      } else {
      }
    });
  });

  sessions.push({
    id: id,
    description: description,
    client: client,
  });

  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);

  if (sessionIndex == -1) {
    console.log("id 160");
    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
};

const init = function (socket) {
  console.log("initiate 176");
  const savedSessions = getSessionsFile();

  if (savedSessions.length > 0) {
    if (socket) {
      console.log("socket true");
      /**
       * At the first time of running (e.g. restarting the server), our client is not ready yet!
       * It will need several time to authenticating.
       *
       * So to make people not confused for the 'ready' status
       * We need to make it as FALSE for this condition
       */
      // savedSessions.forEach((e, i, arr) => {
      //   arr[i].ready = false;
      //   console.log(arr[i]);
      // });

      socket.emit("init", savedSessions);
    } else {
      console.log("socket false");
      savedSessions.forEach((sess) => {
        createSession(sess.id, sess.description);
      });
    }
  }
};

init();

// Socket IO
io.on("connection", function (socket) {
  console.log("initiate 208");
  init(socket);

  socket.on("create-session", function (data) {
    console.log("Create session: " + data.id);
    createSession(data.id, data.description);
  });
});

// Send message
app.post("/send-message", async (req, res) => {
  console.log(req);

  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;
  var senderNumber;
  db.query(
    `SELECT strMobileNo  FROM tblInstance WHERE intInstanceCode=${sender}`,
    function (err, results, fields) {
      //console.log(row);
      if (err) {
        return res.status(500).json([
          {
            message: err,
          },
        ]);
      } else {
        senderNumber = results[0].strMobileNo;
      }
    }
  );
  console.log(senderNumber);

  const client = sessions.find((sess) => sess.id == sender)?.client;

  // // Make sure the sender is exists & ready
  if (!client) {
    var sql = `INSERT INTO tblmessagelog (intInstanceCode,strSender,strRecieve,strMessage,intStatusCode,strResponse,dtCreated) VALUES (${sender},'${senderNumber}','${number}','${message}',2,'${`The sender: ${sender} is not found!`}',NOW())`;
    db.query(sql, function (err, result) {
      if (err) {
        return res.status(500).json([
          {
            message: err,
          },
        ]);
      } else {
      }
    });
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`,
    });
  }
  const isRegisteredNumber = await client.isRegisteredUser(number);

  if (!isRegisteredNumber) {
    var sql = `INSERT INTO tblmessagelog (intInstanceCode,strSender,strRecieve,strMessage,intStatusCode,strResponse,dtCreated) VALUES (${sender},'${senderNumber}','${number}','${message}',3,'The number is not registered',NOW())`;

    db.query(sql, function (err, result) {
      if (err) {
        return res.status(500).json([
          {
            message: err,
          },
        ]);
      } else {
      }
      // res.json([
      //   {
      //     id: result.insertId,
      //     message: req.body.designation,
      //   },
      // ]);
      //req.flash("success", "Data stored!");
    });
    return res.status(422).json({
      status: false,
      message: "The number is not registered",
    });
  }

  client
    .sendMessage(number, message)
    .then((response) => {
      var sql = `INSERT INTO tblmessagelog (intInstanceCode,strSender,strRecieve,strMessage,intStatusCode,strResponse,dtCreated) VALUES (${sender},'${senderNumber}','${number}','${message}',1,'Delivered',NOW())`;
      db.query(sql, function (err, result) {
        if (err) {
          return res.status(500).json([
            {
              message: err,
            },
          ]);
        } else {
        }
        // res.json([
        //   {
        //     id: result.insertId,
        //     message: req.body.designation,
        //   },
        // ]);
        //req.flash("success", "Data stored!");
      });
      res.status(200).json({
        status: true,
        response: message,
      });
    })
    .catch((err) => {
      res.status(500).json({
        status: false,
        response: err,
      });
    });
});
app.post("/send-media", async (req, res) => {
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  const mimitype = req.body.mimitype;
  const filename = req.body.filename;
  const file = req.body.file;

  var senderNumber;
  db.query(
    `SELECT strMobileNo  FROM tblInstance WHERE intInstanceCode=${sender}`,
    function (err, results, fields) {
      //console.log(row);
      if (err) {
        return res.status(500).json([
          {
            message: err,
          },
        ]);
      } else {
        senderNumber = results[0].strMobileNo;
      }
    }
  );
  console.log(senderNumber);

  const client = sessions.find((sess) => sess.id == sender)?.client;

  // // Make sure the sender is exists & ready
  if (!client) {
    var sql = `INSERT INTO tblmessagelog (intInstanceCode,strSender,strRecieve,strMessage,vbrMedia,strMimitype,intStatusCode,strResponse,dtCreated) VALUES (${sender},'${senderNumber}','${number}','${caption}','${file}','${mimitype}',2,'${`The sender: ${sender} is not found!`}',NOW())`;
    db.query(sql, function (err, result) {
      if (err) {
        return res.status(500).json([
          {
            message: err,
          },
        ]);
      } else {
      }
    });
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`,
    });
  }
  const isRegisteredNumber = await client.isRegisteredUser(number);

  if (!isRegisteredNumber) {
    var sql = `INSERT INTO tblmessagelog (intInstanceCode,strSender,strRecieve,strMessage,vbrMedia,strMimitype,intStatusCode,strResponse,dtCreated) VALUES (${sender},'${senderNumber}','${number}','${caption}','${file}','${mimitype}',3,'The number is not registered',NOW())`;

    db.query(sql, function (err, result) {
      if (err) {
        return res.status(500).json([
          {
            message: err,
          },
        ]);
      } else {
      }
      // res.json([
      //   {
      //     id: result.insertId,
      //     message: req.body.designation,
      //   },
      // ]);
      //req.flash("success", "Data stored!");
    });
    return res.status(422).json({
      status: false,
      message: "The number is not registered",
    });
  }

  const myBuffer = Buffer.from(file, "base64");

  const media = new MessageMedia(
    mimitype,
    myBuffer.toString("base64"),
    filename,
    25600
  );

  client
    .sendMessage(number, media, {
      caption: caption,
    })
    .then((response) => {
      var sql = `INSERT INTO tblmessagelog (intInstanceCode,strSender,strRecieve,strMessage,vbrMedia,strMimitype,intStatusCode,strResponse,dtCreated) VALUES (${sender},'${senderNumber}','${number}','${caption}','${file}','${mimitype}',1,'Delivered',NOW())`;
      db.query(sql, function (err, result) {
        if (err) {
          return res.status(500).json([
            {
              message: err,
            },
          ]);
        } else {
        }
        // res.json([
        //   {
        //     id: result.insertId,
        //     message: req.body.designation,
        //   },
        // ]);
        //req.flash("success", "Data stored!");
      });
      res.status(200).json({
        status: true,
        response: caption,
      });
    })
    .catch((err) => {
      res.status(500).json({
        status: false,
        response: err,
      });
    });
});

// server.listen(port, function () {
//   console.log("App running on *: " + port);
// });
server.listen(port, () => {
  console.log(`Server running at https://${hostname}:${port}/`);

  if (process.send) {
    process.send({ event: "online", url: `https://${hostname}:${port}/` });
  }
});
