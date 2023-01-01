var mysql = require("mysql");

var pool = mysql.createPool({
  connectionLimit: 10,
  connectionLimit: 100,
  host: "198.54.114.230",
  user: "contiuvl_waqas", //
  password: "Pe@chgate173", //
  database: "contiuvl_Instance",
});

var DB = (function () {
  function _query(query, params, callback) {
    pool.getConnection(function (err, connection) {
      if (err) {
        connection.release();
        callback(null, err);
        throw err;
      }

      connection.query(query, params, function (err, rows) {
        connection.release();
        if (!err) {
          callback(rows);
        } else {
          callback(null, err);
        }
      });

      connection.on("error", function (err) {
        connection.release();
        callback(null, err);
        throw err;
      });
    });
  }

  return {
    query: _query,
  };
})();

module.exports = DB;
