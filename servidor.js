const express = require("express");
const cors = require("cors");

const app = express();
const puerto = process.env.PUERTO || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ msg: "Backend iniciado" });
});

app.listen(puerto, () => {
    console.log(`Servidor corriendo en http://localhost:${puerto}`);
});
