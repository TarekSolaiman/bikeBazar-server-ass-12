const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Bike Bazar runing now");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bnj1mvk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// verifyJwt token proses
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unathorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  const productsDB = client.db("bikeBazar").collection("products");
  const usersDB = client.db("bikeBazar").collection("users");
  try {
    // Admin verify
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersDB.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // Admin verify
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersDB.findOne(query);
      if (user?.role !== "seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // read products API
    app.get("/products", async (req, res) => {
      const query = {};
      const result = await productsDB.find(query).toArray();
      res.send(result);
    });

    // add products API
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const query = req.body;
      const result = await productsDB.insertOne(query);
      res.send(result);
    });

    // read seller all product
    app.get("/myProducts", verifyJWT, verifySeller, async (req, res) => {
      const userEmail = req.decoded.email;
      const query = { email: userEmail };
      const result = await productsDB.find(query).toArray();
      res.send(result);
    });

    // temporary api for add price filde in appointmentoption
    // app.get("/available", async (req, res) => {
    //   const filter = {};
    //   const updateDoc = {
    //     $set: {
    //       available: "available",
    //       advirtict: false,
    //       sellerVerify: false,
    //     },
    //   };
    //   const option = { upsert: true };
    //   const result = await productsDB.updateMany(filter, updateDoc, option);
    //   res.send(result);
    // });

    // read product with filter category
    app.get("/category/:cat", async (req, res) => {
      const cat = req.params.cat;
      const query = {
        category: cat,
        available: "available",
      };
      const result = await productsDB.find(query).toArray();
      res.send(result);
    });

    // save user data
    app.post("/users", async (req, res) => {
      const query = req.body;
      const result = await usersDB.insertOne(query);
      res.send(result);
    });

    // read users data
    app.get("/users", verifyJWT, async (req, res) => {
      const query = {};
      const result = await usersDB.find(query).toArray();
      res.send(result);
    });

    // send JWT token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const filter = { email: email };
      const user = await usersDB.findOne(filter);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });
  } finally {
  }
}

run().catch((e) => console.log(e.message));

app.listen(port, () => {
  console.log(`Server was running in ${port}`);
});
