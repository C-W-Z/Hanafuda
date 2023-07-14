//#region Lv0 會幫玩家組成役

/* 再抽牌前調整牌差 */
function adjust_deck_Lv0(playerID, max_diff) {
    let card_diff = 0;
    for (let i = 0; i < 4; i++)
        card_diff +=  player[CPU].collect[i].length - player[PLR].collect[i].length;
    if (card_diff <= max_diff)
        return;
    console.log('adjust：', card_diff);
    /* 現在CPU的拿到的牌比玩家多 */
    if (playerID == PLR) /* 輪到玩家抽牌 -> 要抽到可配對的牌 */
        next_is_pair();
    else /* 輪到電腦抽牌 -> 不能抽到可配對的牌 */
        next_not_pair();
}

//#endregion

//#region Lv1 隨機出牌、棄牌、koikoi

function cpu_play_Lv1() {
    player[CPU].selected_handID = -1;
    player[CPU].selected_fieldID = -1;
    loop:
    for (let i = 0; i < player[CPU].hand.length; i++)
        for (let j = 0; j < FIELD_SPACE; j++) {
            if (Math.floor(player[CPU].hand[i]/4) == Math.floor(field.card[j]/4)) {
                player[CPU].selected_handID = i;
                player[CPU].selected_fieldID = j;
                break loop;
            }
        }
    if (player[CPU].selected_handID < 0 || player[CPU].selected_fieldID < 0) {
        player[CPU].selected_handID = 0;
        for (let j = 0; j < FIELD_SPACE; j++)
            if (field.card[j] == -1) {
                player[CPU].selected_fieldID = j;
                break;
            }
    }
}

function cpu_decide_collect_card_Lv1(pairFieldID) {
    return pairFieldID[Math.floor(Math.random() * 2)];
}

function cpu_decide_koi_Lv1() {
    return (Math.floor(Math.random() * 2) == 0);
}

//#endregion

//#region Lv2 出最高價值的牌、棄最低價值的牌

function cpu_play_Lv2() {
    // 找出所有可以出的牌與對應的場牌
    // 找到價值最高的
    player[CPU].selected_handID = -1;
    player[CPU].selected_fieldID = -1;
    for (let i = 0; i < player[CPU].hand.length; i++)
        for (let j = 0; j < FIELD_SPACE; j++) {
            if (field.card[j] < 0) continue;
            if (Math.floor(player[CPU].hand[i]/4) == Math.floor(field.card[j]/4)) {
                if (player[CPU].selected_handID < 0 || player[CPU].selected_fieldID < 0) {
                    player[CPU].selected_handID = i;
                    player[CPU].selected_fieldID = j;
                } else if (card_type[player[CPU].hand[i]] + card_type[field.card[j]] > 
                    card_type[player[CPU].hand[player[CPU].selected_handID]] + card_type[field.card[player[CPU].selected_fieldID]]) {
                    player[CPU].selected_handID = i;
                    player[CPU].selected_fieldID = j;
                }
            }
        }

    // 如果沒找到可配對的 -> 棄價值最低的牌
    if (player[CPU].selected_handID < 0 || player[CPU].selected_fieldID < 0) {
        player[CPU].selected_handID = 0;
        for (let i = 1; i < player[CPU].hand.length; i++)
            if (card_type[player[CPU].hand[i]] < card_type[player[CPU].hand[player[CPU].selected_handID]])
                player[CPU].selected_handID = i;
        for (let j = 0; j < FIELD_SPACE; j++)
            if (field.card[j] == -1) {
                player[CPU].selected_fieldID = j;
                break;
            }
    }
}

function cpu_decide_collect_card_Lv2(pairFieldID) {
    return pairFieldID[Math.floor(Math.random() * 2)];
}

function cpu_decide_koi_Lv2() {
    if (game.month == data.MAXMONTH && player[CPU].total_money < player[PLR].total_money)
        return true;
	if (data.MAXMONTH == 1)
		return (Math.floor(Math.random() * 3) == 0);
    return (Math.floor(Math.random() * 2) == 0);
}

function adjust_deck_Lv2(playerID, max_diff) {
    let card_diff = 0;
    for (let i = 0; i < 4; i++)
        card_diff += player[Number(!playerID)].collect[i].length - player[playerID].collect[i].length;
    if (Math.abs(card_diff) <= max_diff)
        return;
    console.log('adjust：', playerID==PLR ? 'PLR':'CPU', (playerID==PLR) ? card_diff : -card_diff);
    if (card_diff > 0) /* 對方牌比我多 -> 我要抽到可配對的牌 */
        next_is_pair();
    else /* 對方牌比我少 -> 我不能抽到可配對的牌 */
        next_not_pair();
}

//#endregion

function next_is_pair() {
    loop:
    for (let i = 0; i < deck.length; i++)
        for (let j = 0; j < FIELD_SPACE; j++) {
            if (field.card[j] == -1) continue;
            if (Math.floor(deck[i]/4) == Math.floor(field.card[j]/4)) {
                [deck[i], deck[deck.length-1]] = [deck[deck.length-1], deck[i]];
                break loop;
            }
        }
}

function next_not_pair() {
    loop:
    for (let i = 0; i < deck.length; i++) {
        for (let j = 0; j < FIELD_SPACE; j++) {
            if (field.card[j] == -1) continue;
            if (Math.floor(deck[i]/4) == Math.floor(field.card[j]/4))
                continue loop;
        }
        [deck[i], deck[deck.length-1]] = [deck[deck.length-1], deck[i]];
        break;
    }
}