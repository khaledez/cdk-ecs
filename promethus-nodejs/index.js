require("aws-xray-sdk-core");
const xrayExpress = require("aws-xray-sdk-express");
const promBundle = require("express-prom-bundle");
const app = require("express")();
const metricsMiddleware = promBundle({ includeMethod: true });
const morgan = require("morgan");

app.use(xrayExpress.openSegment("defaultName"));
app.use(morgan("combined"));

app.use(metricsMiddleware);

app.use("/health", (req, res) => res.send("healthy"));
app.use("/", (req, res) => res.send("Hello, World"));

app.use(xrayExpress.closeSegment());

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`server is listening on port ${port}`)
);
