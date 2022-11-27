const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
  const paymentDB = client.db("bikeBazar").collection("payment");
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
      res.send({
        isSeller: user?.role === "seller",
      });
    });

    // sellerVerify chake in db
    app.get("/users/verify/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersDB.findOne(query);
      res.send({
        isSeller: user?.sellerVerify,
      });
    });

    // send JWT token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const user = await usersDB.findOne(filter);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "10h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    // payment proses ======================>

    // Stripe payment proses ======>

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const booked = req.body;
      const price = booked.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "USD",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Stripe payment proses ======>

    // After payment proses success full then update booking data ===>

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentDB.insertOne(payment);

      const bookedId = payment.bookingId;
      const productId = payment.productId;
      const filter = { _id: ObjectId(bookedId) };
      const option = { upsert: true };

      const updateDoc = {
        $set: {
          paid: true,
          transictionId: payment.transictionId,
        },
      };

      const updateResult = await bookingDB.updateOne(filter, updateDoc, option);
      res.send(result);
    });

    // After payment proses success full then update booking data ===>

    // read booked data for payment
    app.get("/booked/payment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookedDB.findOne(query);
      res.send(result);
    });
    // read booked data for payment
    // payment proses ======================>

    // read all user only admin can do it
    app.get("/admin/buyers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "buyer" };
      const result = await usersDB.find(query).toArray();
      res.send(result);
    });

    // delete buyer only Admin can do it
    app.delete("/admin/buyers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await usersDB.deleteOne(query);
      res.send(result);
    });

    // read all user only admin can do it
    app.get("/admin/sellers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "seller" };
      const result = await usersDB.find(query).toArray();
      res.send(result);
    });

    // delete seller only Admin can do it
    app.delete("/admin/sellers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await usersDB.deleteOne(query);
      res.send(result);
    });

    // Make Seller verifyed true only Admin can do it
    app.patch("/admin/sellers/:email", async (req, res) => {
      const sellerEmail = req.params.email;
      const query = { email: sellerEmail };
      const updateDoc = {
        $set: {
          sellerVerify: true,
        },
      };
      const ProductResult = await productsDB.updateMany(query, updateDoc);
      const result = await usersDB.updateOne(query, updateDoc);
      res.send(result);
    });

    // read reported item Only Admin can do it
    app.get("/admin/report", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { report: true };
      const result = await productsDB.find(query).toArray();
      res.send(result);
    });

    // Delete reorted item Only Admin can do it
    app.delete("/admin/report/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsDB.deleteOne(query);
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

    // read all orders for seller
    app.get("/myOrders/:email", async (req, res) => {
      const email = req.params.email;
      const query = { sellerEmail: email };
      const result = await bookedDB.find(query).toArray();
      res.send(result);
    });

    // add Booked product in bookedDB
    app.post("/booked", verifyJWT, async (req, res) => {
      const bookedData = req.body;
      const result = await bookedDB.insertOne(bookedData);
      res.send(result);
    });

    // reade booked data for buyer
    app.get("/booked/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { buyerEmail: email };
      const result = await bookedDB.find(query).toArray();
      res.send(result);
    });

    // delete booking data for buyer
    app.delete("/booked/:id", verifyJWT, async (req, res) => {
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
