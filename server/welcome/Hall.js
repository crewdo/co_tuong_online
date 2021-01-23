const Player = require("../model/Player/Player");
const Visitor = require("../model/Player/Visitor");

const Room = require("../model/Room/Room");
const BaseChessMan = require("../model/Chess/BaseChessMan");

class Hall {
    constructor(socketGlobal) {
        this.socketGlobal = socketGlobal;
        this.roomList = {};

    }

    askReceptionist() {

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
                    self.emitNewGameForHost(socket.id)
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

                    if (currentRoomPlayerCount === currentRoom.players.length) {
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
                    } else if (currentRoom.players.length === 0) {
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

                    if(self.roomList[roomId].players[0].id === socket.id) {
                        callback({code: 200, isHost: true});
                        return;
                    }

                    if (Object.keys(socket.rooms).length === 1) {
                        socket.join(roomId);

                        if (self.roomList[roomId].game.state === 0 && self.roomList[roomId].players.length === 1) {
                            var player = new Player({
                                id: socket.id,
                                colorKeeping: BaseChessMan.BLACK_TYPE,
                                name: username
                            })

                            self.roomList[roomId].joinAsPlayer(player);
                            joinType = 'player';

                        } else {
                            var visitor = new Visitor({id: socket.id, name: username})
                            self.roomList[roomId].joinAsVisitor(visitor);
                        }
                        callback({code: 200, isHost: false});

                        //let people know that length of each room list has changed
                        self.emitListOutRooms();

                        //notice member that a user has joined
                        self.socketGlobal.to(`${roomId}`).emit("a_user_joined", {joinType: joinType});
                        self.socketGlobal.to(`${socket.id}`).emit("chess_men_data", {chessMen: self.roomList[roomId].game.chessService.chessMen});
                    }
                }
                else {
                    callback({code: 404, isHost: false});
                }

            });

            socket.on('disconnect', () => {
                socket.disconnect();
            });

            socket.on('user_request_chess_men_data', (roomId, callback) => {
                //check room privately if needed here
                if (self.checkingRoomExisting(roomId)) {
                    let room = self.roomList[roomId];
                    let player = room.getPlayer(socket.id);
                    let visitor = room.getVisitor(socket.id);

                    if(typeof player !== "undefined" || typeof visitor !== "undefined") {
                        callback({chessMen: room.game.chessService.chessMen});
                    }
                }
            });

            socket.on("user_request_start", (roomId, callback) => {
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
                            callback("too_least_player_to_start");
                        }
                    } else {
                        callback("permission_denied");
                    }
                }
            });

            socket.on('user_request_available_pos', (roomId, chessManId, acknowledgement) => {

                let playerInspector = self.guard(roomId, socket.id)
                if (!playerInspector) return;

                let positions = self.roomList[roomId].game.chessService.getAvailablePositionToMoveByChessManId(chessManId, playerInspector);
                acknowledgement(positions)
            });

            socket.on('user_move', (roomId, newPosition, chessManId, acknowledgement) => {

                let playerInspector = self.guard(roomId, socket.id)
                if (!playerInspector) return;

                let game = self.roomList[roomId].game;

                let movingStatus = game.chessService.requestMove(newPosition, chessManId, playerInspector);

                if (movingStatus) {
                    let enemyPlayer = self.roomList[roomId].players.find(value => value.id !== playerInspector.id);

                    game.turnOfUserId = enemyPlayer.id;

                    if (game.chessService.checkEnd(playerInspector)) {
                        self.socketGlobal.to(`${roomId}`).emit("game_over", {winner: playerInspector});

                        if (playerInspector.colorKeeping === BaseChessMan.RED_TYPE) {
                            self.emitNewGameForHost(playerInspector.id);
                        } else {
                            self.emitNewGameForHost(enemyPlayer);
                        }

                        game.lastWinnerUserId = playerInspector.id;
                        game.initialize();

                        acknowledgement();

                        return;
                    }

                    if (game.chessService.attackKingCheck(playerInspector)) {
                        self.socketGlobal.to(`${roomId}`).emit("king_attacking");
                    }

                    self.socketGlobal.to(`${roomId}`).emit("user_moved", {newPosition, chessManId});
                    self.socketGlobal.to(`${roomId}`).emit("chess_men_data", {chessMen: game.chessService.chessMen});

                } else {
                    self.socketGlobal.to(`${socket.id}`).emit("invalid_move");
                }

                acknowledgement()
            });

        });
    }

    emitNewGameForHost(userId) {
        this.socketGlobal.to(`${userId}`).emit("new_game_available");
    }

    emitListOutRooms() {
        this.socketGlobal.emit('list_out_rooms', Room.formatRoomData(this.roomList));
    }

    guard(roomId, playerId) {
        if (this.checkingRoomExisting(roomId)) {

            if (this.roomList[roomId].game.state === 0) return;

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
