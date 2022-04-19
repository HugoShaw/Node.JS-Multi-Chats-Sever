// Require the packages we will use:
const http = require("http"),
    fs = require("fs");
const port = 3456;
const file = "client.html";
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
const server = http.createServer(function (req, res) {
    // This callback runs when a new connection is made to our HTTP server.
    fs.readFile(file, function (err, data) {
        // This callback runs when the client.html file has been read from the filesystem.
        
        if (err) return res.writeHead(500);
        res.writeHead(200);
        res.end(data);
    });
});
server.listen(port);
// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    wsEngine: 'ws'
});


// Build a database in server, so that users can pull data
// users = [{'name': 'hugo', 'id': socket.id}]
const listOfUsers = [];
// rooms = [{'name': 'roomname', category:'', password:"", creator:"", users:[{}]}, {}]
const listOfRooms = [];
// ban = [{roomName:RoomName, username: bannedUser, id: bannedUserID}]
const listOfBans = [];
// message = [{room:roomname, content:{username:username, userid: socket.id, message:message}}, {}]
const listOfMessages = [];

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
    // This callback runs when a new Socket.IO connection is established.
 // socket.on('message_to_server', function (data) {
    //     // This callback runs when the server receives a new message from the client.
    socket.on("create_username", (data, callback) => {
        const username = data.newUser;
        // check the username if it exists or not 
        if (username) {

            let userExists = false;
            for (let i = 0; i < listOfUsers.length; i++) {
                // if username exists, update socket.id
                if (listOfUsers[i].name === username) {
                    listOfUsers[i].id = socket.id;
                    userExists = true;
                    console.log(username + "exists and login successfully with id: " + socket.id);
                    break;
                }
            }
            // if username not exists, store name & socket.id
            if (!userExists) {
                // socket.data.username = username;
                listOfUsers.push({name:username, id:socket.id});
                console.log(username + "is new and login successfully with id: " + socket.id);
            }
            console.log(listOfUsers);
            // let client know it is logged in
            callback({success: true});
        } else {
            // if there is no username send, then throw errors
            callback({success: false, message: "username should not be empty"});
        }
    });

    // server receive new room information
    // room should not have same room with registered rooms
    // room: {name: 'hugo', category: 'private', password:'1234', creator: 'hugo', users:[{user1}]}
    socket.on("create_room", (data, callback) => {
        const roomCreator = data.creator;
        const newRoomName = data.newRoom;
        const ifPrivate = data.private;
        let privatePswd;

        console.log("receive room data: "+newRoomName+":"+ifPrivate);
        if (newRoomName) {
            // check the room if exits or not
            for (let i = 0; i < listOfRooms.length; i++) {
                // if room exists, success: return False
                if(listOfRooms[i].name === newRoomName) {
                    callback({success: false, message: "Room already exists, find a new room name"});
                    return;
                }
            }

            let creatorID;
            // find the room creator socket id
            for (i = 0; i < listOfUsers.length; i++) {
                if (listOfUsers[i].name === roomCreator) {
                    creatorID = listOfUsers[i].id;
                    break;
                }
            }

            // check the room if needs a Password
            // create a room: creator should be the first one in the room
            // true: create a private room
            if (ifPrivate === true) {
                privatePswd = data.password;
                listOfRooms.push({name: newRoomName, category: "private", password: privatePswd,
                    creator: roomCreator, users:[ {name: roomCreator, id: creatorID} ]});
            } else {
            // false: public room
                listOfRooms.push({name: newRoomName, category: "public", 
                creator: roomCreator, users: [ {name: roomCreator, id: creatorID} ] });
            }
            console.log("Room created: {room name: "+newRoomName+", creator: "+roomCreator+"}");
            console.log(listOfRooms);
            callback({success: true});
        }else{
            callback({success: false, message: "room info should not be empty"});
        }
    });

    // display all rooms
    socket.on("display_all_rooms", (data, callback) => {
        const requester = data.requesterName;

        // if the name exists, send back data
        if (requester){
            for (let i = 0; i < listOfUsers.length; i++){
                if (listOfUsers[i].name === requester) {
                    // retrieve all available rooms' name and category
                    const roomsData = [];
                    for (let j = 0; j < listOfRooms.length; j++){
                        roomsData.push({roomName: listOfRooms[j].name, roomCategory: listOfRooms[j].category});
                    }
                    console.log(roomsData);
                    console.log("rooms data is sending to "+requester);
                    callback({
                        success: true,
                        message: roomsData
                    });
                    return;
                }
            }

            callback({success: false, message: "request not found"});

        }else{
            callback({success: false, message: "requester undefined"});
        }

    });

    //  get public room data
    // TODO: user in ban list will not be allowed join
    socket.on("public_room_data", (data, callback) => {
        const requester = data.requesterName;
        const openRoomName = data.openRoom;

        if (requester) {
            // if requester exists, send back data
            for (const user of listOfUsers) {
                if (user.name === requester) {
                    const userId = user.id;

                    // requester exists, but in the ban-list
                    for (const banner of listOfBans){
                        if (banner.username === requester && banner.roomName === openRoomName) {
                            callback({success: false, message: "you are banned from this room"});
                            return;
                        }
                    }

                    // requester exists, but not banned, retrieve the room data
                    for (let i = 0; i < listOfRooms.length; i++){
                        if (listOfRooms[i].name === openRoomName) {
                            // store the requester in the room user list
                            listOfRooms[i]['users'].push({name: requester, id: userId});
                            console.log(listOfRooms[i]);
                            console.log("adding a user:" + requester + " : "+ userId);
                        }
                        callback({success: true, message: listOfRooms[i]});
                        return;
                    }
                }
            }
            callback({success: false, message: "requester not found"});
        }else{
            callback({success: false, message: "requester undefined"});
        }
    });

    // get pricate room data
    // TODO: user in ban list will not be allowed join
    socket.on("private_room_data", (data, callback) => {
        const requester = data.requesterName;
        const openRoomName = data.openRoom;
        const protectedPswd = data.pswd;

        if (requester) {
            // if requester exists, send back data 
            for (const user of listOfUsers) {
                const userId = user.id;

                if (user.name === requester) {
                    // requester exists, but in the ban-list
                    for (const banner of listOfBans){
                        if (banner.username === requester && banner.roomName === openRoomName) {
                            callback({success: false, message: "you are banned from this room"});
                            return;
                        }
                    }

                    // retrieve the room data
                    for (let i = 0; i < listOfRooms.length; i++){
                        // find the private room 
                        if (listOfRooms[i].category == "private"){
                            if (listOfRooms[i].name === openRoomName && listOfRooms[i].password === protectedPswd) {
                                // store the requester in the room user list
                                listOfRooms[i]['users'].push({name: requester, id: userId});
                                callback({success: true, message: listOfRooms[i]});
                                return;
                            }
                        }
                    }
                }
            }
            callback({success: false, message: "requester not found"});
        }else {
            callback({success: false, message: "requester undefined"});
        }
    });

    // check all available users in the room
    socket.on("check_available_users", (data, callback) => {
        const requester = data.requester;
        const RoomName = data.curRoom;
        console.log("user: "+requester+" room: "+RoomName);

        if (requester) {
            // check the users in the room 
            for (const room of listOfRooms) {
                // if find the room 
                if (room.name === RoomName) {
                    // get all users in the room 
                    let usersnames = "";
                    for (const user of room.users) {
                        usersnames = usersnames + user.name + " ";
                    }
                    console.log(usersnames);
                    callback({success: true, availableUsers: usersnames});
                    return;
                }
            }
            
            callback({success: false, message: "users not found"});
        }else {
            callback({success: false, message: "requester undefined"});
        }

    });

    // kick off a user temporarily
    socket.on("kick_off_user", (data, callback) => {
        const requester = data.requesterName;
        const RoomName = data.curRoomName;
        const kickedUser = data.kickedUserName;

        // check user name
        if (requester) {
            for (let i = 0; i < listOfRooms.length; i++){
                // find the right room
                if (listOfRooms[i].name === RoomName) {
                    let index;
                    for (let j = 0; j < listOfRooms[i]['users'].length; j++) {
                        // console.log(listOfRooms[i]['users'][j]);
                        if (listOfRooms[i]['users'][j].name === kickedUser){
                            index = j;
                        } else {
                            index = -1;
                        }
                    }
                    if (index > -1) {
                        listOfRooms[i]['users'].splice(index, 1);
                    }
                    console.log(index);
                    

                    // get all users in the room 
                    let usersnames = "";
                    for (const user of listOfRooms[i]['users']) {
                        usersnames = usersnames + user.name + " ";
                    }
                    console.log(usersnames);

                    if (index  === -1) {
                        callback({success: false, message: "kicked user not found"});
                        return;
                    }

                    io.sockets.emit("check_kicked_room", {roomname: RoomName, users: usersnames});
                    callback({success: true});
                    return;
                }
            }
        } else {
            callback({success: false, message: "requester undefined"});
        }
    });

    // banned a user permanently
    socket.on("ban_user", (data, callback) => {
        const requester = data.requesterName;
        const RoomName = data.curRoomName;
        const bannedUser = data.bannedUserName;

        // check user name
        if (requester) {
            let bannedUserID;
            // if requester exists, send back data 
            for (const user of listOfUsers) {
                if (user.name === bannedUser) {
                    bannedUserID = user.id;
                }
            }

            for (let i = 0; i < listOfRooms.length; i++){
                // find the right room
                if (listOfRooms[i].name === RoomName) {
                    let index;
                    for (let j = 0; j < listOfRooms[i]['users'].length; j++) {
                        // console.log(listOfRooms[i]['users'][j]);
                        if (listOfRooms[i]['users'][j].name === bannedUser){
                            index = j;
                        } else {
                            index = -1;
                        }
                    }
                    if (index > -1) {
                        listOfRooms[i]['users'].splice(index, 1);
                        // add the user to the banned list
                        listOfBans.push(
                            {roomName:RoomName, username: bannedUser, id: bannedUserID}
                        );
                    }

                    console.log(RoomName+" : "+bannedUser+" : "+bannedUserID);
                    console.log(index);
                    
                    // get all users in the room 
                    let usersnames = "";
                    for (const user of listOfRooms[i]['users']) {
                        usersnames = usersnames + user.name + " ";
                    }
                    console.log(usersnames);

                    if (index  === -1) {
                        callback({success: false, message: "banned user not found"});
                        return;
                    }

                    io.sockets.emit("check_ban_room", {banner: bannedUser, roomname: RoomName});
                    callback({success: true});
                    return;
                }
            }
        } else {
            callback({success: false, message: "requester undefined"});
        }
    });

    // receive messages from client, stored in the listOfMessages
    // and send back to the clients
    // message = [{room:roomname, content:{username:username, userid: socket.id, message:message}}, {}]
    socket.on("send_message_to_server", (data, callback) => {
        // get data
        const requester = data.requesterName;
        const RoomName = data.curRoomName;
        const messageData = data.messageData;
        console.log(requester+"is sending message: " + messageData); // log it to the Node.JS output

        // check user name
        if (requester) {
            // user's id
            let userId;
            for (const user of listOfUsers) {
                if (user.name === requester) {
                    userId = user.id;
                }
            }
            // check room name
            if (RoomName) {
                if (messageData){
                    // store the message
                    const dt = {room: RoomName, content:{username: requester, userid: userId, message: messageData}};
                    listOfMessages.push(dt);
                    callback({success: true});

                    // emit the data into clients
                    io.sockets.emit("send_message_to_client", { message: dt }); // broadcast the message to other users
                } else {
                    callback({success: false, message: "message should not be empty"});
                }
            } else {
                callback({success: false, message: "room name undefined"});
            }            
        } else {
            callback({success: false, message: "requester undefined"});
        }

    });

    // send private message to server
    socket.on("send_private_message_to_server", (data, callback) => {
        const sender = data.sender;
        const receiver = data.getter;
        const privateMessage = data.chat;

        console.log(sender + "is sending the message: "+privateMessage + " to the user: "+receiver);

        io.sockets.emit("send_private_message_to_client", {user: sender, getter: receiver, chat: privateMessage});
        callback({success: true});
    });

   
    
});
