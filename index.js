import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "abc123",
  port: 5432,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

db.connect().catch(err => console.error('Connection error', err.stack));

async function checkVisisted() {
  const result = await db.query("SELECT visited_country FROM visited_countries");

  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.visited_country);
  });
  return countries;
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  res.render("index.ejs", { countries: countries, total: countries.length });
});

app.post("/add", async (req, res) => {
  const visitedCountry = req.body.country.trim().toUpperCase(); 
  console.log("Received country:", visitedCountry);  

  try {
    const countryCodeResult = await db.query("SELECT country_code FROM countries WHERE country_name ILIKE '%' || $1 || '%'", [visitedCountry]);

    if (countryCodeResult.rowCount === 0) {
      console.error("Invalid country code");
      return res.render("index.ejs", {
        countries: await checkVisisted(),
        total: (await checkVisisted()).length,
        error: 'This country does not exist, please try again.' // Set error message
      });
    }

    const countryCode = countryCodeResult.rows[0].country_code;

    // Now check if the country has already been added to visited_countries
    const existingCountryResult = await db.query("SELECT * FROM visited_countries WHERE visited_country ILIKE $1", [countryCode]);

    if (existingCountryResult.rowCount > 0) {
      console.error("Country has already been added!");

      return res.render("index.ejs", {
        countries: await checkVisisted(),
        total: (await checkVisisted()).length,
        error: 'Country has already been added!' // Set error message for duplicate country
      });
    }

    // If not already added, insert the new country
    await db.query("INSERT INTO visited_countries (visited_country) VALUES ($1)", [countryCode]);
    res.redirect("/");
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).render("index.ejs", {
        countries: await checkVisisted(),
        total: (await checkVisisted()).length,
        error: 'There was an issue accessing the database. Please try again later.'
    });
    }
});

process.on('SIGINT', async () => {
  await db.end();
  console.log('Database connection closed.');
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
