import React from 'react';
import {getStyleByCoordinate} from './Common';

export const ChessMan = ({rotate, pixelRate, chessMan, onClick}) => {
    return (
        <div className={`chessMan ${chessMan.color}`} onClick={onClick} id={chessMan.id}
             style={getStyleByCoordinate(rotate, pixelRate, chessMan.position)}>
             <img onClick={onClick}
                  id={chessMan.id}
                  src={`/img/chess_1/${chessMan.color + chessMan.type.toLowerCase()}.png`}
                  width={`${pixelRate / 1.2}px`}
                  style={{marginTop:  (pixelRate / 1.2) / 2 * -1 + 'px', marginLeft:  (pixelRate / 1.2) / 2 * -1 + 'px'}}
             >
             </img>
            </div>
    );
}