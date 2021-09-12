require("aws-xray-sdk-core");
const xrayExpress = require("aws-xray-sdk-express");
const promBundle = require("express-prom-bundle");
const app = require("express")();
const metricsMiddleware = promBundle({ includeMethod: true });

app.use(xrayExpress.openSegment("defaultName"));

app.use(metricsMiddleware);

app.use((req, res, next) => {
  console.log("request has been started");
  console.log(req.url);
  next();
  console.log("request has been finished");
});

app.use("/health", (req, res) => res.send("healthy"));
app.use("/", (req, res) => res.send("Hello, World"));

app.use(xrayExpress.closeSegment());

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`server is listening on port ${port}`)
);
