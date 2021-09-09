const promBundle = require("express-prom-bundle");
const app = require("express")();
const metricsMiddleware = promBundle({ includeMethod: true });

app.use(metricsMiddleware);

app.use((req, res, next) => {
  console.log("request has been started");
  console.log(req.url);
  next();
  console.log("request has been finished");
});

app.use("/health", (req, res) => res.send("healthy"));
app.use("/", (req, res) => res.send("Hello, World"));

app.listen(process.env.PORT || 3000, () =>
  console.log("server is listening on 3000")
);
