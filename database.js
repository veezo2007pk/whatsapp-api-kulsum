var mysql = require("mysql");
var connection = mysql.createConnection({
  host: "166.62.10.190",
  user: "kihlive", //
  password: "e_V=g6]zQ[rA", //
  database: "kihlive",

  // typeCast: function castField(field, useDefaultTypeCasting) {
  //   // We only want to cast bit fields that have a single-bit in them. If the field
  //   // has more than one bit, then we cannot assume it is supposed to be a Boolean.
  //   if (field.type === "BIT" && field.length === 1) {
  //     var bytes = field.buffer();

  //     // A Buffer in Node represents a collection of 8-bit unsigned integers.
  //     // Therefore, our single "bit field" comes back as the bits '0000 0001',
  //     // which is equivalent to the number 1.
  //     return bytes[0] === 1;
  //   }

  //   return useDefaultTypeCasting();
  // },
});
connection.connect((err) => {
  if (err) {
    console.log(err);
    return;
  }
  console.log("Database connected");
});
module.exports = connection;
