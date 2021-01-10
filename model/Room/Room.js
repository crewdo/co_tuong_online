const Player  =  require('../Player/Player');
const Game =  require('../Game/Game');
const BaseChessMan =  require('../Chess/BaseChessMan');

class Room {

    constructor(roomId)
    {
        this.roomId = roomId;
        this.players = []
        this.visitors = [];
    }

    static get ROOM_NAME_PREFIX()
    {
        return 'chinese_chess_room_id_'
    }

    initialize(id, newUsername)
    {
        var player = new Player({id: id, colorKeeping:  BaseChessMan.RED_TYPE, name : newUsername})

        if(this.joinAsPlayer(player))
        {
            this.game = new Game(this);
        }
    }


    joinAsPlayer(player)
    {
        if(this.players.length === 2) return false;

        if(this.players.some(value => value.id === player.id)) return false;

        this.players.push(player);

        return true;
    }

    joinAsVisitor(visitor)
    {
        if(this.visitors.some(value => value.id === visitor.id)) return false;

        this.visitors.push(visitor);

        return true;
    }

    getPlayer(id)
    {
        return this.players.filter(value => value.id === id)[0];
    }

    static formatRoomData(allRooms) {
        return Object.keys(allRooms).filter(key => key.indexOf(Room.ROOM_NAME_PREFIX) !== -1)
            .reduce((obj, key) => { obj[key] = {length: allRooms[key].players.length, visitors : allRooms[key].visitors.length}; return obj; }, {});
    }

    static filterCurrentRoomId(playerRooms) {

        let currentRoomObject = Object.keys(playerRooms).filter(key => key.indexOf(Room.ROOM_NAME_PREFIX) !== -1);

        if(currentRoomObject.length > 0) return currentRoomObject[0];

        return false;
    }

}

module.exports = Room;