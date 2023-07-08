// 一張牌在一幀內的移動
// 回傳結束了沒
function step_move(cardID, sX, sY, dX, dY, flip = false) {
    return function(time) {
        const deltaTime = (time - startTime) / MOVE_TIME;
        if (deltaTime >= 1) {
            card[cardID].px = dX;
            card[cardID].py = dY;
            card[cardID].scaleX = 1;
            startTime = null;
            time_func = next_func;
            return true;
        } else {
            // moving animation
            card[cardID].px = easeInOutQuad(time-startTime, sX, (dX-sX)*deltaTime, MOVE_TIME);// sX + (dX - sX) * deltaTime;
            card[cardID].py = easeInOutQuad(time-startTime, sY, (dY-sY)*deltaTime, MOVE_TIME);// sY + (dY - sY) * deltaTime;
            // flip
            if (flip == true) {
                card[cardID].scaleX = Math.abs(0.5 - deltaTime) + 0.5;
                if (deltaTime >= 0.5)
                    card[cardID].back = false;
            }
        }
        return false;
    }
}

// 一幀的發牌動畫
function deal_step(cards, i) {
    if (i < HAND_NUM)
        return function(time) {
            const px = SCREEN_W / 2 + (CARD_W+CARD_GAP*2) * (i - HAND_NUM / 2) + CARD_GAP;
            const cx = SCREEN_W / 2 + (CARD_W+CARD_GAP*2) * (HAND_NUM / 2 - i - 1) + CARD_GAP;
            const dy = CARD_GAP;
            // to cpu hand
            step_move(cards[CPU + 1][i], (SCREEN_W-CARD_W)/2, (SCREEN_H-CARD_H)/2, cx, dy, false)(time);
            // to player hand
            step_move(cards[PLR + 1][i], (SCREEN_W-CARD_W)/2, (SCREEN_H-CARD_H)/2, px, SCREEN_H - (CARD_H+CARD_GAP*2) + dy, true)(time);
            // 發下2張牌
            next_func = deal_step(cards, i + 1);
        }

    return function(time) {
        for (let i = 0; i < HAND_NUM; i++) {
            const fx = Field.X(i + (FIELD_SPACE - HAND_NUM) / 2);
            const fy = Field.Y(i);
            // to field
            step_move(cards[0][i], (SCREEN_W-CARD_W)/2, (SCREEN_H-CARD_H)/2, fx, fy, true)(time);
        }
        next_func = after_deal(cards);
    }
}

/* shuffle deck */
function shuffle(deck) {
    let shuffle_end = false;
    while (!shuffle_end) {
        // shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const r = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[r]] = [deck[r], deck[i]];
        }
        // 檢查場上(deck[0...7])會不會出現3張以上同月分的牌(會不會有牌永遠留在場上無法被吃掉)
        let month = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let flag = true;
        for (let i = CARD_NUM - 1; i >= CARD_NUM - HAND_NUM; i--) {
            month[Math.floor(deck[i] / 4)]++;
            if (month[Math.floor(deck[i] / 4)] >= 3)
                flag = false;
        }
        shuffle_end = flag;
    }
}

/* 發牌 */
function deal_cards() {
    game.state = gameState.deal;

    // distribute cards
    let new_card = [[], [], []]; // 0:field, 1:player, 2:cpu
    for (let j = 0; j < 3; j++)
        for (let i = 0; i < HAND_NUM; i++) {
            new_card[j].push(deck.pop());
            movingCard.push(new_card[j][i]);
            card[new_card[j][i]].place = cardPlace.moving;
        }

    // animation
    startTime = performance.now(); // reset startTime
    time_func = deal_step(new_card, 0);
}

function after_deal(new_card) {
    return function (time) {
        endAnimation();

        // put to players' hand & field
        for (let i = 0; i < HAND_NUM; i++)
            field.insertCard(i+(FIELD_SPACE-HAND_NUM)/2, new_card[0][i]);
        for (let i = 0; i < HAND_NUM; i++)
            player[PLR].addHand(new_card[PLR + 1][i]);
        for (let i = 0; i < HAND_NUM; i++)
            player[CPU].addHand(new_card[CPU + 1][i]);

        // 第一回合開始
        game.round = 0;
        (game.round % 2 == game.first) ? player_play() : cpu_play();
    }
}

/* 玩家的回合 */
function player_play() {
    game.state = gameState.player_select_hand;
}

/* 玩家出牌 */
function player_play_card(playerID, handID, fieldID) {
    if (playerID == PLR)
        game.state = gameState.player_play_card;

    let handCardID = player[playerID].hand[handID];
    // 從手牌和場上移除handID和fieldID的2張牌
    player[playerID].removeHand(handID);

    // animation
    startTime = performance.now(); // reset startTime
    movingCard.push(handCardID);
    // 分為(手牌與場牌)有可以配對的與無可配對的2種情況
    if (field.card[fieldID] == -1) {
        // 棄牌
        time_func = step_move(handCardID, card[handCardID].px, card[handCardID].py, Field.X(fieldID), Field.Y(fieldID));
        next_func = after_play(playerID, handCardID, -1, fieldID);
    } else {
        time_func = step_move(handCardID, card[handCardID].px, card[handCardID].py, Field.X(fieldID), Field.Y(fieldID) + 10);
        next_func = player_collect_animation(playerID, handCardID, fieldID);
    }
}

function player_collect_animation(playerID, handCardID, fieldID) {
    return function (time) {
        //endAnimation();
        //console.log("f", field.card[fieldID]);
        let fieldCardID = field.card[fieldID];
        field.removeCard(fieldID);
        // next animation
        // startTime = performance.now(); // reset startTime
        // this is temp -> next is move to cards to collect
        time_func = after_play(playerID, handCardID, fieldCardID);
    }
}

function after_play(playerID, handCardID, fieldCardID, fieldID = -1) {
    return function (time) {
        // 保證月份相同
        // 手牌已經移除打出的牌，場上也移除對應的牌，都移到movingCard了

        endAnimation();

        if (fieldCardID >= 0) {
            // put to player's collect
            player[playerID].addCollect(handCardID);
            player[playerID].addCollect(fieldCardID);
        } else {
            // put to field
            field.insertCard(fieldID, handCardID);
        }

        // draw card from deck
        draw_new_card(playerID);
    }
}

function draw_new_card(playerID) {
    // draw card
    let new_card = deck.pop();
    player[playerID].draw_cardID = new_card;

    // show the new card
    card[new_card].back = false;
    card[new_card].place = cardPlace.moving;
    movingCard.push(new_card);

    // find the pair card
    let fieldID;
    let pairFieldID = [];
    // find if there are pair cards
    for (let i = 0; i < FIELD_SPACE; i++)
        if (Math.floor(field.card[i] / 4) == Math.floor(new_card / 4))
            pairFieldID.push(i);

    if (pairFieldID.length == 0)
    {
        // find space on field
        for (let i = 0; i < FIELD_SPACE; i++)
            if (field.card[i] == -1) {
                fieldID = i;
                break;
            }
        draw_card_animation(playerID, new_card, fieldID, -1);
    }
    else if (pairFieldID.length >= 2)
    {
        if (playerID == PLR) {
            // wait for player choose
            game.state = gameState.player_choose_card;
            field.update_noticed(Math.floor(new_card/4));
        } else /* CPU */ {
            // 未完成
            fieldID = pairFieldID[0];
            draw_card_animation(playerID, new_card, fieldID, field.card[fieldID]);
        }
    }
    else // only one card can pair
    {
        fieldID = pairFieldID[0];
        draw_card_animation(playerID, new_card, fieldID, field.card[fieldID]);
    }
}

function draw_card_animation(playerID, new_card, fieldID, fieldCardID) {
    if (playerID == PLR)
        game.state = gameState.player_end_round;

    if (fieldCardID >= 0) {
        // remove the card from field
        field.removeCard(fieldID);
    }
    // animation
    startTime = performance.now(); // reset startTime
    time_func = step_move(new_card, DECK_P.x, DECK_P.y, Field.X(fieldID), Field.Y(fieldID));
    // 這裡還要加上collect的動畫
    next_func = after_draw_new_card(playerID, new_card, fieldID, fieldCardID);
}

function after_draw_new_card(playerID, new_cardID, fieldID, fieldCardID) {
    return function (time) {
        endAnimation();

        if (fieldCardID != -1) {
            // put to player's collect
            player[playerID].addCollect(new_cardID);
            player[playerID].addCollect(fieldCardID);
        } else {
            // put to field
            field.insertCard(fieldID, new_cardID);
        }

        // round end
        // check yaku and check win or next round
        check_win(playerID);
    }
}

function check_win(playerID) {
    const win = player[playerID].check_yaku();
    if (player[CPU].hand.length == 0 && player[PLR].hand.length == 0)
    {
        // end this month
        if (win)
            player_win(playerID);
        else if (game.koi != -1)
            player_win(game.koi);
        else {
            // 親權
            player[game.first].yaku[0] = 1;
            player[game.first].score += yaku_score[0];
            player_win(game.first);
        }
    } else if (win) {
        // 若是最後一回合 => 強制結束
        if (player[playerID].hand.length == 0)
            player_win(playerID);
        // ask koi koi or not
        else if (playerID == PLR)
            game.state = gameState.player_decide_koi;
        else {
            if (Math.floor(Math.random() * 2))
                koikoi(CPU);
            else
                player_win(CPU);
        }
    } else {
        // next round
        game.round++;
        (game.round % 2 == game.first) ? player_play() : cpu_play();
    }
}

function player_win(playerID) {
    game.winner = playerID;
    game.state = gameState.month_end;
    player[playerID].money[game.month-1] = player[playerID].score * (game.koi_bouns ? player[playerID].koi_time+1 : 1);
    player[playerID].total_money += player[playerID].money[game.month-1];
}

function draw_decide_koi() {
    // draw panel
    koi_panel.draw();

    // the size of panel of decide koi
    const w = koi_panel.w, h = koi_panel.h;
    // draw texts
    context.fillStyle = 'white';
    context.font = 32 * R + "px 'Yuji Syuku', 'Microsoft YaHei', sans-serif";
    context.fillText("こいこいしますか？", (SCREEN_W/2) * R, (SCREEN_H/2 - h/4) * R);
    context.font = 20 * R + "px 'Yuji Syuku', 'Microsoft YaHei', sans-serif";
    context.fillText(`現在の獲得文数：${player[PLR].score}文`, (SCREEN_W/2) * R, (SCREEN_H/2 - h/24) * R);

    // draw buttons
    end_button.draw();
    koi_button.draw();
}

function koikoi(playerID) {
    game.state = gameState.koikoi_animation;
    game.koi = playerID;
    player[playerID].koi_time++;

    // animation
    startTime = performance.now();
    time_func = koi_step();
    next_func = function (time) {
        endAnimation();
        // next round
        game.round++;
        (game.round % 2 == game.first) ? player_play() : cpu_play();
    }
}

function draw_koikoi() {
    koikoi_banner.draw();
}

// show koikoi UI
function koi_step() {
    return function (time) {
        const duration = (7 * MOVE_TIME);
        const deltaTime = (time - startTime) / duration;
        const open_speed = 6;
        if (deltaTime >= 1) {
            // end
            koikoi_banner.fillColor = 'rgba(0,0,0,0)';
            koikoi_banner.borderColor = 'rgba(0,0,0,0)';
            koikoi_banner.textColor = 'rgba(0,0,0,0)';
            startTime = null;
            time_func = next_func;
        } else if (deltaTime > 0.6) {
            // fade
            const alpha = easeInQuad(time-startTime, 1, -2*(deltaTime-0.6), duration*0.4);
            koikoi_banner.fillColor = `rgba(255,215,0,${alpha})`;
            koikoi_banner.borderColor = `rgba(255,255,255,${alpha})`;
            koikoi_banner.textColor = `rgba(255,0,0,${alpha})`;
        } else if (deltaTime > 0.4) {
            // show 0.2*duration ms
            koikoi_banner.fillColor = 'gold';
            koikoi_banner.borderColor = 'white';
            koikoi_banner.textColor = 'red';
        } else {
            // emerge
            const alpha = easeOutQuad(time-startTime, 0, 4*deltaTime, duration*0.4);
            //koikoi_banner.fillColor = `rgba(255,215,0,${alpha})`;
            //koikoi_banner.borderColor = `rgba(255,255,255,${alpha})`;
            koikoi_banner.fillColor = 'gold';
            koikoi_banner.borderColor = 'white';
            koikoi_banner.textColor = `rgba(255,0,0,${alpha})`;
            if (deltaTime <= 1/open_speed) {
                const width = easeInOutQuad(time-startTime, 0, open_speed*(deltaTime), duration/open_speed) * 100;
                koikoi_banner.y = SCREEN_H/2 - width/2;
                koikoi_banner.h = width;
            }
        }
    }
}

function draw_show_yaku() {
    yaku_panel.draw();
    const w = yaku_panel.w, h = yaku_panel.h, py = yaku_panel.y;
    // draw who win
    context.fillStyle = 'white';
    const fontsize = 32;
    context.font = fontsize * R + "px 'Yuji Syuku', 'Microsoft YaHei', sans-serif";
    const text = (game.winner == PLR) ? '勝利' : '敗北';
    const title_h = 100;
    context.fillText(text, (SCREEN_W/2) * R, (py + title_h/2) * R);
    // draw yaku
    context.font = 20 * R + "px 'Yuji Syuku', 'Microsoft YaHei', sans-serif";
    let count = 0;
    const max_show = (game.koi_bouns) ? 8 : 9;
    for (let i = 0; i < YAKU_NUM; i++)
        if (player[game.winner].yaku[i] > 0) {
            count++;
            if (count <= max_show) {
                context.fillText(yaku_name[i], (SCREEN_W/2 - w/4) * R, (py + title_h/2 + fontsize + count * 24) * R);
                context.fillText(`${player[game.winner].yaku[i] * yaku_score[i]}文`, (SCREEN_W/2 + w/4) * R, (py + title_h/2 + fontsize + count * 24) * R);
            } else if (count == max_show+1) {
                context.fillText('···', (SCREEN_W/2 - w/4) * R, (py + title_h/2 + fontsize + count * 24) * R);
                context.fillText('···', (SCREEN_W/2 + w/4) * R, (py + title_h/2 + fontsize + count * 24) * R);
            }
        }
    if (game.koi_bouns) {
        // draw koi koi time
        context.fillText(`こいこい${player[game.winner].koi_time}次`, (SCREEN_W/2 - w/4) * R, (py + h - title_h/2 - fontsize) * R);
        context.fillText(`x${player[game.winner].koi_time+1}`, (SCREEN_W/2 + w/4) * R, (py + h - title_h/2 - fontsize) * R);
        // draw total score
        context.fillText('合計', (SCREEN_W/2 - w/4) * R, (py + h - title_h/2) * R);
        context.fillText(`${player[game.winner].score * (player[game.winner].koi_time+1)}文`, (SCREEN_W/2 + w/4) * R, (py + h - title_h/2) * R);
    } else {
        context.fillText('合計', (SCREEN_W/2 - w/4) * R, (py + h - title_h/2) * R);
        context.fillText(`${player[game.winner].score}文`, (SCREEN_W/2 + w/4) * R, (py + h - title_h/2) * R);
    }

    // draw button
    if (game.month < game.MAXMONTH)
        next_month_button.draw();
    else
        to_result_button.draw();
}

function result_game() {
    game.state = gameState.game_result;
}

function draw_game_result() {
    result_panel.draw();
    const w = result_panel.w, h = result_panel.h, py = result_panel.y;

    // draw who win
    context.fillStyle = 'white';
    const fontsize = 32;
    context.font = fontsize * R + "px 'Yuji Syuku', 'Microsoft YaHei', sans-serif";
    const text = (player[PLR].total_money > player[CPU].total_money) ? '勝利' : '敗北';
    const title_h = 100;
    context.fillText(text, (SCREEN_W/2) * R, (py + title_h/2) * R);

    // draw scores
    context.font = 20 * R + "px 'Yuji Syuku', 'Microsoft YaHei', sans-serif";
    context.fillText('あなた', (SCREEN_W/2) * R, (py + title_h) * R);
    context.fillText('相手', (SCREEN_W/2 + w/4) * R, (py + title_h) * R);
    for (let i = 1; i <= game.MAXMONTH; i++) {
        context.fillText(`${i}月`, (SCREEN_W/2 - w/4) * R, (py + title_h + i * 24) * R);
        context.fillText((player[PLR].money[i-1] > 0) ? `${player[PLR].money[i-1]}文` : '-',
                         (SCREEN_W/2) * R, (py + title_h + i * 24) * R);
        context.fillText((player[CPU].money[i-1] > 0) ? `${player[CPU].money[i-1]}文` : '-',
                         (SCREEN_W/2 + w/4) * R, (py + title_h + i * 24) * R);
    }
    context.fillText('合計', (SCREEN_W/2 - w/4) * R, (py + h - title_h/2) * R);
    context.fillText(`${player[PLR].total_money}文`, (SCREEN_W/2) * R, (py + h - title_h/2) * R);
    context.fillText(`${player[CPU].total_money}文`, (SCREEN_W/2 + w/4) * R, (py + h - title_h/2) * R);
}

/* AI的回合 */
function cpu_play() {
    game.state = gameState.cpu_play;

    // 找出所有可以出的牌與對應的場牌
    // 找到價值最高的
    player[CPU].selected_handID = -1;
    player[CPU].selected_fieldID = -1;
    for (let i = 0; i < player[CPU].hand.length; i++)
        for (let j = 0; j < FIELD_SPACE; j++) {
            if (field.card[j] < 0) continue;
            if (Math.floor(player[CPU].hand[i]/4) == Math.floor(field.card[j]/4))
            {
                if (player[CPU].selected_handID < 0 || player[CPU].selected_fieldID < 0) 
                {
                    player[CPU].selected_handID = i;
                    player[CPU].selected_fieldID = j;
                }
                else if (card_type[player[CPU].hand[i]] + card_type[field.card[j]] > 
                    card_type[player[CPU].hand[player[CPU].selected_handID]] + card_type[field.card[player[CPU].selected_fieldID]])
                {
                    player[CPU].selected_handID = i;
                    player[CPU].selected_fieldID = j;
                }
            }
        }

    // 如果沒找到可配對的 -> 棄牌
    if (player[CPU].selected_handID < 0 || player[CPU].selected_fieldID < 0) {
        player[CPU].selected_handID = 0;
        for (let i = 1; i < player[CPU].hand.length; i++)
            if (card_type[player[CPU].hand[i]] > card_type[player[CPU].hand[player[CPU].selected_handID]])
                player[CPU].selected_handID = i;
        for (let j = 0; j < FIELD_SPACE; j++)
            if (field.card[j] == -1) {
                player[CPU].selected_fieldID = j;
                break;
            }
    }
    
    player_play_card(CPU, player[CPU].selected_handID, player[CPU].selected_fieldID);
}

function player_select_hand(handID) {
    card[player[PLR].hand[handID]].selected = true;
    field.update_noticed(Math.floor(player[PLR].hand[handID] / 4));
    player[PLR].selected_handID = handID;
}
function player_unselect_hand(handID) {
    card[player[PLR].hand[handID]].selected = false;
    field.update_noticed(-1);
    player[PLR].selected_handID = -1;
}