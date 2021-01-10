const Player = require("../model/Player/Player");
const Visitor = require("../model/Player/Visitor");

const Room = require("../model/Room/Room");
const BaseChessMan = require("../model/Chess/BaseChessMan");

class Hall {
    constructor(socketGlobal) {
        this.socketGlobal = socketGlobal;
        this.roomList = {};

    }

    reception() {
        let self = this;

        this.socketGlobal.on("connection", function (socket) {
            socket.on('user_online', function () {
                self.emitListOutRooms()
            });

            socket.on('user_created_room', (username, callback) => {
                if (Object.keys(socket.rooms).length === 1) {

                    let newRoomId = Room.ROOM_NAME_PREFIX + Math.random().toString(36).substring(2);

                    socket.join(newRoomId);
                    callback(newRoomId);

                    self.roomList[newRoomId] = new Room(newRoomId);
                    self.roomList[newRoomId].initialize(socket.id, username);

                    //emit to all online users that there's new room has just created.
                    self.emitListOutRooms();
                    self.socketGlobal.to(`${socket.id}`).emit("chess_men_data", {chessMen: self.roomList[newRoomId].game.chessService.chessMen});

                }
            });

            socket.on('disconnecting', function () {

                var rooms = socket.rooms;
                var socketInRoom = Room.filterCurrentRoomId(rooms);

                if (socketInRoom && self.checkingRoomExisting(socketInRoom)) {

                    var currentRoom = self.roomList[socketInRoom];

                    let currentRoomPlayerCount = currentRoom.players.length;

                    let leftType = 'player';
                    //Process Remove Player From Room
                    currentRoom.players = currentRoom.players.filter(e => {
                        return e.id !== socket.id;
                    });

                    if(currentRoomPlayerCount === currentRoom.players.length)
                    {
                        //Process Remove Visitor From Room
                        currentRoom.visitors = currentRoom.visitors.filter(e => {
                            return e.id !== socket.id;
                        });

                        leftType = 'visitor';
                    }

                    //To notice people in room aware that a player has just left
                    self.socketGlobal.to(`${currentRoom.roomId}`).emit("a_user_left", {leftType: leftType});

                    //If only one stay in Room, set his color to xRed.
                    if (currentRoom.players.length === 1) {
                        currentRoom.players[0].colorKeeping = BaseChessMan.RED_TYPE;
                        currentRoom.game.gameRestart();
                    }
                    else if (currentRoom.players.length === 0)
                    {
                        //emit a room has just removed
                        self.socketGlobal.emit('a_room_removed', {roomId: currentRoom.roomId});
                        //this also remove game refer to room.
                        delete self.roomList[socketInRoom];
                    }

                    self.emitListOutRooms();

                }

            });

            socket.on('user_joined', (roomId, username, callback) => {

                var joinType = 'visitor';

                if (typeof socket.adapter.rooms[roomId] !== "undefined" && typeof self.roomList[roomId] !== "undefined") {

                    if (Object.keys(socket.rooms).length === 1) {

                        socket.join(roomId);

                        if (self.roomList[roomId].game.state === 0 && self.roomList[roomId].players.length === 1) {

                            var player = new Player({
                                id: socket.id,
                                colorKeeping: BaseChessMan.BLACK_TYPE,
                                name: username
                            })

                            self.roomList[roomId].joinAsPlayer(player);

                            callback('Joined as Player');

                            joinType = 'player';
                        } else {
                            var visitor = new Visitor({id: socket.id, name: username})
                            self.roomList[roomId].joinAsVisitor(visitor);
                            callback('Joined as Visitor');
                        }

                        //let people know that length of each room list has changed
                        self.emitListOutRooms();

                        //notice member that a user has joined
                        self.socketGlobal.to(`${roomId}`).emit("a_user_joined", {joinType: joinType});

                        //notice member current game chessMen data
                        self.socketGlobal.to(`${socket.id}`).emit("chess_men_data", {chessMen: self.roomList[roomId].game.chessService.chessMen});

                    }
                }

            });

            socket.on('disconnect', () => {
                socket.disconnect();
            });

            socket.on("user_request_start", (roomId) => {
                if (self.checkingRoomExisting(roomId)) {


                    let room = self.roomList[roomId];
                    let host = room.getPlayer(socket.id);

                    if (typeof host !== "undefined" && host.colorKeeping === BaseChessMan.RED_TYPE) {
                        if (room.players.length === 2) {
                            if (room.game.start()) {
                                self.socketGlobal.to(`${roomId}`).emit("user_turned",
                                    {step: room.game.step, user_turned: room.game.turnOfUserId}
                                );
                            }
                        } else {
                            self.socketGlobal.to(`${socket.id}`).emit("too_least_player_to_start");
                        }
                    } else {
                        self.socketGlobal.to(`${socket.id}`).emit("permission_denied");
                    }
                }

            });

            socket.on('user_request_available_pos', (roomId, chessManId) => {

                console.log(roomId, chessManId);
                let playerInspector = self.guard(roomId, socket.id)
                if (!playerInspector) return;
                console.log(playerInspector);

                var positions = self.roomList[roomId].game.chessService.getAvailablePositionToMoveByChessManId(chessManId, playerInspector);
                self.socketGlobal.to(`${socket.id}`).emit("available_positions", {available_positions: positions});

            });

            socket.on('user_request_move', (roomId, newPos, chessManId) => {

                if (!self.guard(roomId, socket.id)) return;

                //crewtodo: process moving
                //check pos validity
                //check move by get availabe pos
                //process moving
                self.socketGlobal.to(`${currentRoom.roomId}`).emit("user_moved", {newPos, chessManId});
            });

        });
    }

    emitListOutRooms()
    {
        this.socketGlobal.emit('list_out_rooms', Room.formatRoomData(this.roomList));
    }

    guard(roomId, playerId) {
        if (this.checkingRoomExisting(roomId)) {

            if(this.roomList[roomId].game.state === 0) return;

            let player = this.roomList[roomId].getPlayer(playerId);

            if (typeof player !== "undefined") {

                return player.id === this.roomList[roomId].game.turnOfUserId ? player : false;
            }

            return false
        }
    }

    checkingRoomExisting(roomId) {
        return typeof this.roomList[roomId] !== "undefined";
    }

}

module.exports = Hall;
