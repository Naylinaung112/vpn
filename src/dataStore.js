const fs = require("fs");
const path = require("path");

// Define the path for the JSON file to store data
const dataFilePath = path.join(__dirname, "data.json");

// Function to save data
function saveData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null));
}

// Function to load data
function loadData() {
  try {
    const data = fs.readFileSync(dataFilePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return {}; // Return an empty object if the file does not exist or is invalid
  }
}

// Function to create or update an item
function upsertItem(key, value) {
  const data = loadData();

  data[key] = value;
  saveData(data);
}

// Function to read an item
function readItem(key) {
  const data = loadData();
  return data[key];
}

// Function to delete an item
function deleteItem(key) {
  const data = loadData();
  delete data[key];
  saveData(data);
}

module.exports = {
  saveData,
  loadData,
  upsertItem,
  readItem,
  deleteItem,
};
