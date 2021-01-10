const BaseChessMan = require( './BaseChessMan');

class Cannon extends BaseChessMan {

    constructor({color, initPos}) {
        super({color, initPos});
        this.type = 'C';
    }

    static get defaultPositions()
    {
        return [{x: 1, y: 2}, {x: 7, y: 2}, {x: 1, y: 7}, {x: 7, y: 7}];
    }

    getAvailablePositionsToMoveOrKill(chessMen)
    {
        let x = this.position.x;
        let y = this.position.y;

        let straightPosition = this.goStraight(chessMen);

        //crewtodo: Checking Kill for Cannon (need Color To Check)
        for(let i = 0; i < straightPosition.theManStanding.length; i++)
        {

        }

        return straightPosition.positions;
    }
}

module.exports = Cannon;