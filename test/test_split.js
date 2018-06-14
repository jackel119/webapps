const split = (itemname, uidList, splitAmounts) => {

};

// Bill type:
// {
//  groupID: null if not a group transaction
//  users: [user1, user2, etc] list of UIDs of users involved
//  description: 'some kind of bill description'
//  items : [ //optional
//            {
//              itemname: 'apple',
//              price:     1.5,
//              (optional?) split: (same as split field below)
//            },
//            {
//              itemname: 'banana',
//              price:     2
//            }
//          ],
//  totalprice : 3.5,
//  splitType: totalEvenSplit/totalPercentage/byItem,
//  split: {
//          user1: splitAmount1,
//          user2: splitAmount2
//         } // overall split of the total
//  author: uid of author,
//  (potentially?) payee: user1,
//  timestamp: time
// }
