import mysql from "mysql2/promise";

// change these to match your MySQL (XAMPP default: root with empty password)
const config = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
};
const DB = "retail_store";

const conn = await mysql.createConnection(config);

const run = async (title, sql, params = []) => {
  const [result] = await conn.query(sql, params);
  console.log(`\n${title}`);
  if (Array.isArray(result)) console.table(result);
  else console.log("OK -", result.info || `${result.affectedRows} row(s) affected`);
  return result;
};

// start clean so the script can be run more than once
await conn.query(`DROP DATABASE IF EXISTS ${DB}`);
await conn.query(`DROP USER IF EXISTS 'store_manager'@'localhost'`);
await conn.query(`CREATE DATABASE ${DB}`);
await conn.query(`USE ${DB}`);

// 1- create the tables
await run(
  "1- Create Suppliers table",
  `CREATE TABLE Suppliers (
     SupplierID INT AUTO_INCREMENT PRIMARY KEY,
     SupplierName TEXT,
     ContactNumber TEXT
   )`
);
await run(
  "1- Create Products table",
  `CREATE TABLE Products (
     ProductID INT AUTO_INCREMENT PRIMARY KEY,
     ProductName TEXT,
     Price DECIMAL(10,2),
     StockQuantity INT,
     SupplierID INT,
     FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID)
   )`
);
await run(
  "1- Create Sales table",
  `CREATE TABLE Sales (
     SaleID INT AUTO_INCREMENT PRIMARY KEY,
     ProductID INT,
     QuantitySold INT,
     SaleDate DATE,
     FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
   )`
);

// 2- add Category column
await run("2- Add Category column", `ALTER TABLE Products ADD COLUMN Category VARCHAR(50)`);

// 3- remove Category column
await run("3- Drop Category column", `ALTER TABLE Products DROP COLUMN Category`);

// 4- ContactNumber to VARCHAR(15)
await run(
  "4- Change ContactNumber to VARCHAR(15)",
  `ALTER TABLE Suppliers MODIFY ContactNumber VARCHAR(15)`
);

// 5- ProductName NOT NULL
await run(
  "5- ProductName NOT NULL",
  `ALTER TABLE Products MODIFY ProductName VARCHAR(100) NOT NULL`
);

// 6- basic inserts
const supplier = await run(
  "6.a- Insert supplier FreshFoods",
  `INSERT INTO Suppliers (SupplierName, ContactNumber) VALUES (?, ?)`,
  ["FreshFoods", "01001234567"]
);
const supplierId = supplier.insertId;

const milk = await run(
  "6.b- Insert Milk",
  `INSERT INTO Products (ProductName, Price, StockQuantity, SupplierID) VALUES (?, ?, ?, ?)`,
  ["Milk", 15.0, 50, supplierId]
);
await run(
  "6.b- Insert Bread",
  `INSERT INTO Products (ProductName, Price, StockQuantity, SupplierID) VALUES (?, ?, ?, ?)`,
  ["Bread", 10.0, 30, supplierId]
);
await run(
  "6.b- Insert Eggs",
  `INSERT INTO Products (ProductName, Price, StockQuantity, SupplierID) VALUES (?, ?, ?, ?)`,
  ["Eggs", 20.0, 40, supplierId]
);
await run(
  "6.c- Insert sale of 2 Milk",
  `INSERT INTO Sales (ProductID, QuantitySold, SaleDate) VALUES (?, ?, ?)`,
  [milk.insertId, 2, "2025-05-20"]
);

// 7- update Bread price
await run("7- Update Bread price to 25.00", `UPDATE Products SET Price = 25.00 WHERE ProductName = 'Bread'`);

// 8- delete Eggs
await run("8- Delete Eggs", `DELETE FROM Products WHERE ProductName = 'Eggs'`);

// 9- total quantity sold for each product
await run(
  "9- Total quantity sold per product",
  `SELECT p.ProductID, p.ProductName, CAST(COALESCE(SUM(s.QuantitySold), 0) AS UNSIGNED) AS TotalSold
   FROM Products p
   LEFT JOIN Sales s ON s.ProductID = p.ProductID
   GROUP BY p.ProductID, p.ProductName`
);

// 10- product with the highest stock
await run(
  "10- Product with the highest stock",
  `SELECT * FROM Products
   WHERE StockQuantity = (SELECT MAX(StockQuantity) FROM Products)`
);

// 11- suppliers whose name starts with F
await run("11- Suppliers starting with F", `SELECT * FROM Suppliers WHERE SupplierName LIKE 'F%'`);

// 12- products that were never sold
await run(
  "12- Products never sold",
  `SELECT p.* FROM Products p
   LEFT JOIN Sales s ON s.ProductID = p.ProductID
   WHERE s.SaleID IS NULL`
);

// 13- all sales with product name and sale date
await run(
  "13- Sales with product name and date",
  `SELECT s.SaleID, p.ProductName, s.QuantitySold, s.SaleDate
   FROM Sales s
   JOIN Products p ON p.ProductID = s.ProductID`
);

// 14- create store_manager with SELECT, INSERT, UPDATE on all tables
await run(
  "14- Create user store_manager",
  `CREATE USER 'store_manager'@'localhost' IDENTIFIED BY 'Manager@123'`
);
await run(
  "14- Grant SELECT, INSERT, UPDATE",
  `GRANT SELECT, INSERT, UPDATE ON ${DB}.* TO 'store_manager'@'localhost'`
);
await run("14- Current grants", `SHOW GRANTS FOR 'store_manager'@'localhost'`);

// 15- revoke UPDATE
await run("15- Revoke UPDATE", `REVOKE UPDATE ON ${DB}.* FROM 'store_manager'@'localhost'`);
await run("15- Current grants", `SHOW GRANTS FOR 'store_manager'@'localhost'`);

// 16- grant DELETE on Sales only
await run("16- Grant DELETE on Sales", `GRANT DELETE ON ${DB}.Sales TO 'store_manager'@'localhost'`);
await run("16- Current grants", `SHOW GRANTS FOR 'store_manager'@'localhost'`);

await conn.end();
