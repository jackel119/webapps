// go from a bill, to a list of transactions
var receiveBill = (bill) => {
  var tx_list = [];
  var billID;
  // store groupID, billID, bill as JSON inside db
  for (var user of bill.users) {
    tx_list.push({
      to: bill.payee,
      from: user,
      amount: bill.split[user],
      currency: 0,
      description: bill.description,
      groupID: bill.groupID
    });
  console.log(tx_list);
  }  
};

var bill = {
 groupID: null
 users: [user1, user2]
 description: 'some kind of bill description'
 items : [ //optional
           item1: {
             itemname: 'apple',
             price:     1.5,
           },
           item1: {
             itemname: 'banana',
             price:     2
           }
         ],
 totalprice : 3.5,
 splitType: 'even',
 split: {
         user1: plitAmount,
         user2: splitAmount
        } // overall split of the total
 author: uid of author,
 (potentially?) payee: uid
}
