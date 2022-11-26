const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
  const bookedDB = client.db("bikeBazar").collection("booked");
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

    // admin chake in db
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersDB.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

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

    // seller chake in db
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersDB.findOne(query);
      res.send({ isSeller: user?.role === "seller" });
    });

    // send JWT token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
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

    // read all user only admin
    app.get("/admin/buyers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "buyer" };
      const result = await usersDB.find(query).toArray();
      res.send(result);
    });

    // read all user only admin
    app.get("/admin/sellers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "seller" };
      const result = await usersDB.find(query).toArray();
      res.send(result);
    });

    // read products with Advirtict for advirtict section
    app.get("/advirtict", async (req, res) => {
      const query = { advirtict: true };
      const result = await productsDB.find(query).toArray();
      res.send(result);
    });

    // update Advirtict false for advirtict section
    app.patch("/advirtict/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          advirtict: true,
        },
      };
      const result = await productsDB.updateOne(query, updateDoc);
      res.send(result);
    });

    // add products in db with seller
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const query = req.body;
      const result = await productsDB.insertOne(query);
      res.send(result);
    });

    // read  all product in seller
    app.get("/myProducts", verifyJWT, verifySeller, async (req, res) => {
      const userEmail = req.decoded.email;
      const query = { email: userEmail };
      const result = await productsDB.find(query).toArray();
      res.send(result);
    });

    // delete product by seller
    app.delete("/myProducts/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsDB.deleteOne(query);
      res.send(result);
    });

    // temporary api for add price filde in appointmentoption
    // app.get("/available", async (req, res) => {
    //   const filter = {};
    //   const updateDoc = {
    //     $set: {
    //       available: "available",
    //       report: false,
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

    // add Booked product in bookedDB
    app.post("/booked", verifyJWT, async (req, res) => {
      const bookedData = req.body;
      const result = await bookedDB.insertOne(bookedData);
      res.send(result);
    });

    // reade booked data for buyer
    app.get("/booked/:email", async (req, res) => {
      const email = req.params.email;
      const query = { buyerEmail: email };
      const result = await bookedDB.find(query).toArray();
      res.send(result);
    });

    // delete booking data for buyer
    app.delete("/booked/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookedDB.deleteOne(query);
      res.send(result);
    });

    // Reported item true
    app.patch("/report/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          report: true,
        },
      };
      const result = await productsDB.updateOne(query, updateDoc);
      res.send(result);
    });
  } finally {
  }
}

run().catch((e) => console.log(e.message));

app.listen(port, () => {
  console.log(`Server was running in ${port}`);
});
