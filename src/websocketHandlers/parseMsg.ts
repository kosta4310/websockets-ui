import { RawData, WebSocket } from "ws";
import { MessageFromClient, MyWebSocket, Player } from "../types/types";
import {
  createPlayer,
  createGame,
  updateRoom,
  startGame,
  changePlayersTurn,
  attack,
  finish,
  updateWinners,
  UpdateRoom,
  addWinner,
} from "./methods";
import { parseShipField } from "./parseShipField";
import { StatusAttack, statusAttack } from "./statusAttack";
import { wss } from "../ws_server";

/* Object game под индексом комнаты будет массив в котором будет обьект с полем 
idPlayer которому будет соответствовать массив кораблей и текущий игрок*/

/*Массив, в котором по индексу(индекс комнаты) находятся index игроков в этих комнатах*/
type Rooms = Array<Array<number>>;

const listWaitedRooms = new Map<number, UpdateRoom>();
const listWaitedPlayers = new Set<number>();

const rooms: Rooms = [];
export const players: { [idPlayer: string]: Player } = {};
export const idsWs = new Map<number, MyWebSocket>();
export const winners = new Map<number, { name: string; wins: number }>();

let idPlayer = 0;
let idGame = 0;

export function parseMsg(message: RawData, ws: MyWebSocket) {
  console.log("message from client: %s", message.toString());

  const { type, data }: MessageFromClient = JSON.parse(message.toString());
  const parsedData = data ? JSON.parse(data) : "";

  switch (type) {
    case "reg":
      const { name, password } = parsedData;
      ws.bsname = name;
      ws.bspassword = password;
      ws.bsid = idPlayer;
      players[idPlayer.toString()] = {
        name,
        ships: [],
        shooted: [],
        parsedShips: [],
        killedShips: 9,
        wins: 0,
        password,
      };
      idsWs.set(idPlayer, ws);
      createPlayer(idPlayer, name, password, ws);

      idPlayer++;

      if (listWaitedRooms.size) {
        const listAccessibleRooms = Array.from(listWaitedRooms.values());
        updateRoom(listAccessibleRooms);
      }

      if (winners.size) {
        updateWinners(Array.from(winners.values()), new Set([ws]));
      }

      break;

    case "create_room":
      console.log(ws.bsid);

      if (!listWaitedPlayers.has(ws.bsid)) {
        listWaitedPlayers.add(ws.bsid);

        listWaitedRooms.set(ws.bsid, {
          roomId: idGame,
          roomUsers: [{ name: ws.bsname, index: ws.bsid }],
        });
        rooms.push([ws.bsid]);

        const listAccessibleRooms = Array.from(listWaitedRooms.values());
        console.log("list", listAccessibleRooms);
        updateRoom(listAccessibleRooms);

        idGame++;
      }

      break;

    case "add_user_to_room":
      const { indexRoom } = parsedData;
      const idfirstPlayer = ws.bsid;
      if (rooms[indexRoom].length === 1) {
        rooms[indexRoom].push(idfirstPlayer);

        createGame(indexRoom, idfirstPlayer, ws);

        const idSecondPlayer = rooms[indexRoom][0];

        ws.bsidEnemy = idSecondPlayer;
        const websocketSecondPlayer = idsWs.get(idSecondPlayer);

        if (websocketSecondPlayer) {
          websocketSecondPlayer.bsidEnemy = idfirstPlayer;
        }

        createGame(
          indexRoom,
          idSecondPlayer,
          websocketSecondPlayer as MyWebSocket
        );

        [idfirstPlayer, idSecondPlayer].forEach((item) => {
          listWaitedPlayers.delete(item);
          listWaitedRooms.delete(item);
        });

        const listAccessibleRooms = Array.from(listWaitedRooms.values());
        console.log("list", listAccessibleRooms);
        updateRoom(listAccessibleRooms);
      }

      break;

    case "add_ships":
      console.log("rooms", rooms);

      let { gameId, ships, indexPlayer } = parsedData;
      const parsedShips = parseShipField(ships);
      players[indexPlayer].parsedShips = parsedShips;
      if (rooms[gameId].length === 3) {
        rooms[gameId].pop();
        ws.bsShips = ships;

        players[indexPlayer].ships = ships;
        const websocketFirstPlayer = ws;

        startGame(ships, indexPlayer, websocketFirstPlayer);

        const websocketSecondPlayer = idsWs.get(
          websocketFirstPlayer.bsidEnemy
        ) as MyWebSocket;

        const shipsSecondPlayer = websocketSecondPlayer.bsShips;

        const idSecondPlayer = websocketSecondPlayer.bsid;

        startGame(
          shipsSecondPlayer as unknown as Array<any>,
          idSecondPlayer,
          websocketSecondPlayer
        );
        // разыгрываем чей первый ход
        const indexFirstTurn =
          Math.random() < 0.5 ? indexPlayer : idSecondPlayer;
        rooms[gameId].push(indexFirstTurn);

        /*третим элементов в массиве будет индекс текущего игрока*/
        changePlayersTurn(indexFirstTurn, [
          websocketFirstPlayer,
          websocketSecondPlayer,
        ] as Array<MyWebSocket>);
      } else {
        rooms[gameId].push(-1);
        players[indexPlayer].ships = ships;
        ws.bsShips = ships;
      }

      break;

    case "attack":
      const {
        x,
        y,
        indexPlayer: idCurrentPlayer,
      } = parsedData as {
        x: number;
        y: number;
        gameId: number;
        indexPlayer: number;
      };

      const firstWs = idsWs.get(idCurrentPlayer) as WebSocket;
      const [indexSecondPlayer] = rooms[parsedData.gameId].filter(
        (item) => item !== idCurrentPlayer
      );
      const secondWs = idsWs.get(indexSecondPlayer) as WebSocket;

      // зайдет в IF если соблюден ход игрока и выстрел в эту точку еще не был сделан
      if (
        idCurrentPlayer === rooms[parsedData.gameId][2] &&
        !players[idCurrentPlayer].shooted.includes("" + x + y)
      ) {
        players[idCurrentPlayer].shooted.push("" + x + y);
        const { ships, parsedShips } = players[indexSecondPlayer];

        const [status, killedShipWhithEmptyCell] = statusAttack({
          x,
          y,
          ships,
          parsedShips,
        });

        if (status === StatusAttack.Killed) {
          if (killedShipWhithEmptyCell) {
            for (const item of killedShipWhithEmptyCell as Map<
              { x: number; y: number },
              StatusAttack
            >) {
              const [position, status] = item;

              attack(position, idCurrentPlayer, status, [secondWs, firstWs]);
            }
          }

          players[idCurrentPlayer].killedShips++;
        } else {
          attack({ x, y }, idCurrentPlayer, status as StatusAttack, [
            secondWs,
            firstWs,
          ]);
        }

        if (status === StatusAttack.Miss) {
          changePlayersTurn(indexSecondPlayer, [secondWs, firstWs]);
          rooms[parsedData.gameId].splice(-1, 1, indexSecondPlayer);
        } else {
          changePlayersTurn(idCurrentPlayer, [secondWs, firstWs]);
        }
      } else if (idCurrentPlayer === rooms[parsedData.gameId][2]) {
        changePlayersTurn(idCurrentPlayer, [secondWs, firstWs]);
      }

      // добавление победителя

      if (players[idCurrentPlayer].killedShips === 10) {
        [idCurrentPlayer, indexSecondPlayer].forEach((ind) => {
          players[ind].killedShips = 9;
          players[ind].shooted = [];
        });

        // -------------- killedShips понемять на 0

        finish(idCurrentPlayer, [secondWs, firstWs]);

        addWinner(idCurrentPlayer);
        const arrayWinners = Array.from(winners.values());
        updateWinners(arrayWinners, wss.clients);
      }

      break;

    default:
      console.log("default: ", message.toString());

      return "Error";
  }
}
