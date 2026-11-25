# -*- coding: utf-8 -*-
"""英語のページ（/en/）の文。site2.py の lang='en' のところが読む。
- アプリの名前・サブタイトル・説明は、いちばん下の STORE_EN（App Store の英語の文のコピー）
- アプリの中は日本語・いまは日本の App Store だけで配信、を正直に書く（ほかの国に出すかはまだ決めていない）
- 本名・勤め先は書かない。数はぜんぶ site2.py で数える（ここに数を書かない）
"""

BRAND_EN = 'Ima Apps'
TAGLINE_EN = 'One small puzzle a day'

# ジャンル（apps_data.CATS と同じ id）
CAT_EN = {'puzzle': 'Puzzles', 'relax': 'Relaxing', 'versus': 'Versus', 'life': 'Everyday life'}

# 毎日の1問の1行（apps_data.DAILY_LINE の英語）: (見出し, 説明)
DAILY_EN = {
    'hitofude': ('Daily caterpillar', 'Same board for everyone - race the clock'),
    'suji': ('Daily rooms & residents', 'Two new logic puzzles - race the clock'),
    'okazu': ('Daily bento', 'Fewest pieces left, then fastest time'),
    'kakezan': ('Daily stage', 'One long course - how far can you run?'),
    'jimidrive': ('Daily drive', 'Same license plates, same order for everyone'),
    'yudetamago': ('Daily egg', 'Everyone peels the same egg - best score'),
    'nattofilm': ('Daily natto', 'Everyone peels the same natto - best score'),
}

# ブラウザ版（/play/<app>/。画面は日本語）で何をするかの短い説明
PLAY_EN = {
    'hitofude': ('Today\'s caterpillar', 'Drag from the caterpillar\'s head and eat every leaf exactly once. Same board as the app.'),
    'suji': ('Today\'s room split', 'Divide the grid into rectangles; each room has one number equal to its size.'),
    'okazu': ('Today\'s bento', 'Drag the food pieces into the lunch box in order. Full rows and columns get eaten.'),
    'jimidrive': ('Today\'s drive', 'Can the 4 digits on the plate make 10 with + − × ÷? Decide in a few seconds.'),
    'yudetamago': ('Today\'s egg', 'Tap to crack the shell, then drag slowly to peel it without tearing the white.'),
    'kakezan': ('Today\'s stage', 'Pick the left or right math gate to make your number bigger. Don\'t drop to 0.'),
    'gekokujo': ('A match vs CPU', 'Play cards 1-9 one at a time. The higher number wins the round - but 1 beats 9.'),
}

# スクリーンショットの alt（apps_data.SHOTS のファイル名ごと）。画面の中の文字は日本語
SHOT_ALT_EN = {
    'hitofude': {'1_play': 'Tracing the caterpillar across the leaves', '2_clear': 'All leaves eaten - the caterpillar becomes a butterfly',
                 '3_twist': 'A board with warp holes and other twists', '5_daily': 'The daily caterpillar and its ranking', '6_title': 'Title screen'},
    'suji': {'1_rooms': 'Splitting the grid into rooms', '2_residents': 'Placing residents', '3_find': 'A hint that explains why',
             '4_daily': 'The daily puzzles and ranking', '5_select': 'Stage select'},
    'okazu': {'1_play': 'Packing food into the lunch box', '2_clear': 'A full row gets eaten', '3_twist': 'A new twist in a later chapter',
              '5_daily': 'The daily bento and its ranking', '6_title': 'Title screen'},
    'kakezan': {'1_play': 'Choosing a math gate while running', '2_daily': 'The long daily course', '4_revive': 'The screen when you\'re out',
                '5_title': 'Title screen'},
    'jimidrive': {'3_correct': 'A correct answer: the plate\'s four digits make 10', '1_title': 'Title screen on a night expressway',
                  '2_plate': 'The license plate of a passing car', '5_result': 'Result after reaching the destination', '4_zukan': 'The collection of cars and local plates'},
    'yudetamago': {'1_quail': 'Peeling a quail egg', '3_easter': 'An Easter egg', '4_zukan': 'The collection of 18 eggs', '5_title': 'Title screen'},
    'nattofilm': {'1_peel': 'Peeling the film off a pack of natto', '3_pick': 'Choosing a kind of natto', '4_zukan': 'The natto collection',
                  '5_title': 'Title screen'},
    'madoshizuku': {'1_neon': 'Gathering raindrops on a window over neon streets', '2_yudachi': 'A sudden downpour', '3_sleep': 'Sleep rain sounds',
                    '4_card': 'A postcard of the city reflected in a drop'},
    'hensokushogi': {'1_online': 'Playing a friend online with a room code', '2_trump': 'A card shogi game', '3_annan': 'An Annan shogi game',
                     '4_tsume': 'A variant tsume problem', '5_title': 'Title screen'},
    'pokerstudy': {'1_quiz': 'A quiz: the seat diagram and your two cards', '2_answer': 'The answer with a range chart', '3_charts': 'Range charts',
                   '4_build': 'Building a spot to see a suggested range'},
    'gekokujo': {'1_gekokujo': 'A 1 beating a 9', '2_rival': 'Rivals in ranked matches', '3_result': 'The review table after a match',
                 '4_online': 'An online room', '5_title': 'Title screen'},
    'futaridaifugo': {'1_play': 'Playing two cards on a pair of sixes', '2_rules': 'The special card rules', '3_result': 'The result and the opponent\'s last cards',
                      '4_online': 'Waiting in an online room', '5_title': 'Title screen'},
}

# くらしのアプリ（英語のページはない。日本語のページへ）: (英語の呼び名, 1行)
LIFE_EN = {
    'sanpobingo': ('Walk diary', 'A one-page-a-day diary of your steps and the places you went, plus a walking bingo.'),
    'tsundoku': ('Tsundoku tower', 'Stack your unread books into a tower, then read them to bring it down.'),
    'osouji': ('Household chores', 'Share cleaning chores at home: report them and check them off together.'),
    'notre-app': ('Notre Endroit', 'A private app for two - a shared diary and more for couples.'),
}

# 説明文の見出し（ALL CAPS）を、ふつうの書き方に。ここにないものは「先頭だけ大文字」にする
HEAD_EN = {'OTHER': 'Good to know', 'PRACTICE TABLES VS CPU (OFFLINE)': 'Practice tables vs CPU (offline)', 'CPU WITH 10 LEVELS': 'CPU with 10 levels',
           'READING HINTS (CPU MATCHES)': 'Reading hints (CPU matches)', 'ACROSS JAPAN, STARTING FROM TOKYO': 'Across Japan, starting from Tokyo',
           'RANK UP TO MEIJIN': 'Rank up to Meijin', '2250 VARIANT TSUME PROBLEMS': '2250 variant tsume problems'}

# 画面の小さな文
UI = {
    'skip': 'Skip to content', 'menu_open': 'Open menu', 'home': 'Home', 'apps': 'Games', 'play': 'Play in browser', 'about': 'About', 'faq': 'FAQ',
    'ja': '日本語', 'crumb': 'Breadcrumb', 'store_s1': 'Download on the', 'store_s2': 'App Store (Japan)', 'soon': 'Coming soon',
    'more': 'Details →', 'play_btn': '▶ Play in browser', 'play_daily': '▶ Play today\'s puzzle',
}

NAV_EN = [('/en/', 'Home'), ('/en/play/', 'Play in browser'), ('/en/apps/', 'Games'), ('/en/about/', 'About'), ('/en/faq/', 'FAQ')]

AVAIL_EN = ('Available on the App Store in Japan. We haven\'t decided yet whether to release the apps in other countries, '
            'so the App Store links may not open from a store in another country.')
AVAIL_SOON_EN = ('Coming soon to the App Store in Japan (now in App Review). Like our other games, it will be available in Japan only for now, '
                 'so the App Store link may not open from a store in another country.')
LANG_EN = 'Menus and in-game text are in Japanese for now. Most games are easy to play without reading Japanese.'

ABOUT_EN = {
    'lead': 'Hi, I\'m Ima. I make small iPhone games on my own.',
    'paras': ['I like shogi (Japanese chess), poker and making apps. I plan, design, program and submit every app to the App Store myself.',
              'My favorite kind of game is one you can play in a short break: one puzzle a day, the same for everyone, so you can compare with other players fairly.'],
    'likes': [('♟️', 'Shogi'), ('🃏', 'Poker'), ('📱', 'Making apps')],
    'values': ['Short sessions you can play in a spare minute',
               'No account or sign-in - just a nickname if you want to join a ranking',
               'Collect as little data as possible, and keep records on your iPhone when we can'],
}

FAQ_EN = [
    ('Are the apps free?', ['Yes. Every app is free to download and play, with no in-app purchases. Most games are supported by ads; each game\'s page explains where ads appear.']),
    ('Can I download them outside Japan?', ['The apps are currently available on the App Store in Japan only. We haven\'t decided whether to release them in other countries yet.',
                                            'If your Apple Account uses a different country\'s App Store, the App Store links on this site may not open the app.']),
    ('Are the games in English?', ['Not yet. Menus and in-game text are in Japanese for now. Most of the games are easy to play without reading Japanese, and each game page on this site explains the rules in English.']),
    ('When does the daily puzzle change?', ['Every day at midnight Japan time (JST, UTC+9) - that is 15:00 UTC. Everyone gets the same puzzle that day.']),
    ('Do I need an account to join the rankings?', ['No. Just choose a nickname. No sign-in or email address is needed, and you can delete your nickname and records from the ranking screen at any time.']),
    ('Can I play without installing anything?', ['Yes. Several daily puzzles (and a match against the CPU in Gekokujo Duel) can be played in your web browser, with no sign-up. The game screens are in Japanese. See <a href="/en/play/">Play in your browser</a>.']),
    ('Where is my data stored?', ['Game records are basically saved on your iPhone. If you join a ranking, only your nickname and records are sent.']),
    ('Will I get notifications?', ['Some games with a daily puzzle ask whether you\'d like an optional daily reminder at 7 pm. You can turn it off any time in Settings.']),
    ('Is there an Android version?', ['No, the apps are for iPhone only.']),
    ('How can I contact you?', ['Send an email to <a href="mailto:imaimaha.apps@gmail.com">imaimaha.apps@gmail.com</a>. English or Japanese is fine. I make the apps alone, so a reply may take a little time.']),
]

# 英語の App Store の文（~/Developer/apps/<App>/AppStore.md の「English (en-US) store listing」からそのままコピー。2026-11-19）
# ストアの文を書きかえたら、ここも同じに書きかえる（name・sub・promo・desc）
STORE_EN = {
 'hitofude': dict(
  name='Caterpillar: One Line Puzzle',
  sub='Eat every leaf in one stroke',
  promo='Trace a path and help the caterpillar eat every leaf exactly once - then watch it turn into a butterfly. 200 stages with new twists each chapter, plus a new daily puzzle.',
  desc="Caterpillar: One Line Puzzle is a simple one-stroke drawing puzzle. Drag from the caterpillar's head across the board and eat every leaf exactly once. Finish the board and the caterpillar becomes a chrysalis, then flies away as a butterfly.\n\nHOW TO PLAY\n• Drag from the caterpillar's head to a neighboring leaf\n• Each leaf can be eaten only once. Eat them all to clear the stage\n• Took a wrong turn? Trace back along your path and continue from there, or start over\n• If you get stuck, a small guide offers a restart or a hint\n\n200 STAGES IN 20 CHAPTERS\nEvery chapter adds a new twist:\n• Stones: you can't pass them\n• Free start: on boards without a caterpillar, start from any leaf you like\n• Chrysalis branch: it must be the very last square\n• One-way leaves: you can only leave in the arrow's direction\n• Big leaves: visit them twice\n• Warp holes: holes of the same color are connected\n• Numbing mushrooms: after eating one, your next step must go straight\n• Berries: eat them in order, 1, 2, 3\nFrom chapter 11 the boards grow up to 9×9, and each has exactly one solution. Chapters 1-11 are open from the start; later chapters unlock one by one. Each new twist is explained with a small picture card, and you can tap a special square to see its rule.\n\nSTARS\nClear faster to earn up to 3 stars per stage (the target times are shown on screen). Going back never costs stars.\n\nDAILY PUZZLE\nA new board every day at midnight Japan time - the same board for every player, mixing all kinds of twists. Your first try goes to the ranking; after that you can practice as often as you like. Replay your route square by square, and play past days' puzzles too (not ranked). During your first 7 days, hints are available in the daily puzzle as well (+30 seconds each).\n\nRANKING\nCompare today's daily puzzle score and your total stars with all players, using just a nickname. No account or sign-in needed. Your nickname and records are sent only if you choose a nickname, and you can delete them from the ranking screen at any time.\n\nHOME SCREEN WIDGET\nSee at a glance whether you've solved today's puzzle, your streak, and the time until the next one. Tap it to jump straight to the daily puzzle.\n\nLANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\nOTHER\n• 3 free hints per day. After that, you can watch a short video ad to get another hint (optional - the game is fully playable without it)\n• Banner ads appear on the title, chapter select, stage select and clear screens, never while you are tracing. A full-screen ad may occasionally appear when you leave the clear screen\n• Vibration can be turned off\n• No login. Your stars and records are saved on your device. Anonymous play counts per stage (no IDs or names) help us tune difficulty; you can turn this off"),
 'suji': dict(
  name='Number Rooms: Rectangle Puzzle',
  sub='Split rooms, place residents',
  promo="Split the grid into rectangular rooms that match their numbers, then place residents - one per row and column. Cute residents move in when you're right. 365 stages.",
  desc="Number Rooms is a cozy logic puzzle about apartment floor plans. Use the numbers as clues to divide the grid into rooms. When a room is right, residents such as cats, ghosts, grandpas and robots move in and the furniture appears. Most puzzles take 30 seconds to 2 minutes - just right for a short break.\n\nROOM SPLIT (245 stages)\n• Divide the grid into rectangles (squares are OK)\n• Each room contains exactly one number, which equals the number of cells in that room\n• Drag to draw a room; tap a room to erase it\n• Grids from 5×5 to 11×11, across 15 floors\n\nFIND THE RESIDENTS (120 stages)\n• Place residents in the colored rooms - as many as the room's number\n• Every row and every column has exactly one resident\n• Residents never touch each other, not even diagonally\n• Tap a cell to mark × (empty), tap again for a resident. Drag to mark many × at once\n• Grids from 5×5 to 11×11, across 10 floors\n\nEASY TO START\nA short hands-on tutorial teaches each rule. Every puzzle has exactly one solution and can be solved by logic alone - no guessing needed.\n\nHINTS THAT EXPLAIN\nA hint shows one room (or resident) that can be decided next and tells you why. If you have a wrong room, it points that out first.\n\nDAILY PUZZLES\nOne new Room Split and one new Find the Residents every day at midnight Japan time - the same puzzles for everyone. Your first try of the day goes to the ranking; after that, practice as much as you like. Replay your moves step by step, and play past days' puzzles too (not ranked).\n\nRANKING\nCompare today's times and your total stars with all players, using just a nickname. No account or sign-in needed. Your nickname and records are sent only if you choose a nickname, and you can delete them from the ranking screen at any time.\n\nHOME SCREEN WIDGET\nSee whether you've solved today's puzzles, your streak, and the time until the next ones.\n\nLANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\nOTHER\n• Clear faster to earn up to 3 stars per stage. Your best times are saved\n• 3 free hints per day. After that, you can watch a short video ad to get another hint (optional)\n• Banner ads appear on the title, stage select and result screens, never while you are solving. A full-screen ad may occasionally appear when you leave the result screen\n• Vibration can be turned off\n• No login. Your stars and records are saved on your device. Anonymous play counts per stage (no IDs or names) help us tune difficulty; you can turn this off"),
 'okazu': dict(
  name='Bento Pack: Food Block Puzzle',
  sub='Fill rows in your lunch box',
  promo='Pack food into a Japanese lunch box in a set order. Complete a row or column and it gets eaten - yum! New twists across 200 stages, plus a daily bento for everyone.',
  desc='Bento Pack is a block puzzle where you fill a Japanese lunch box. Food pieces come in a set order - drag each one into the box. Complete a full row or column and the food in it gets eaten and cleared. Reach the goal and say "Itadakimasu!" to clear the stage.\n\nHOW TO PLAY\n• Drag a food piece from the plate into the lunch box. A shadow shows where it will go\n• Tap a piece to rotate it 90 degrees\n• The "next" list shows the whole order of upcoming pieces, so you can plan ahead\n• Out of space? Undo a move and try again\n\nTHE FOOD\nPickled plum, edamame, octopus-shaped sausage, broccoli, rolled omelet, fried chicken, fried shrimp, rice ball, spaghetti, hamburg steak and salmon - each with a little face that smiles when a row is about to be filled.\n\n200 STAGES IN 20 CHAPTERS\nEvery 10 stages bring a new twist:\n• Rice already in the box that you need to eat\n• Baran dividers: you can\'t place food on them, but they count toward a row\n• Perfect fit: fill the box completely, with no gaps\n• Fixed pieces that can\'t be rotated\n• Favorite food: eat a certain dish a certain number of times\n• Side plate: keep one piece aside for later\n• Frozen food: it thaws on the first clear and is eaten on the second\n• Big 7×7 boxes with two goals\nFrom chapter 11: bigger boxes with two or three goals, and perfect-fit stages with only one way to pack.\nClear faster to earn up to 3 stars per stage (target times are shown on screen). Undoing never costs stars.\n\nDAILY BENTO\nOne new puzzle every day at midnight Japan time - the same puzzle for everyone. Pack every piece with no gaps. Players are ranked by fewest pieces left, then fewest restarts, then fastest time. Your first try is ranked; after that, practice as much as you like. Replay your packing move by move, and play past days\' puzzles too (not ranked).\n\nRANKING\nCompare today\'s daily bento and your total stars with all players, using just a nickname. No account or sign-in needed. Your nickname and records are sent only if you choose a nickname, and you can delete them from the ranking screen at any time.\n\nHOME SCREEN WIDGET\nSee whether you\'ve solved today\'s bento, your streak, and the time until the next one.\n\nLANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\nOTHER\n• Up to 3 undos and 1 hint per stage are free. After that, you can watch a short video ad to use more (optional)\n• Banner ads appear on the title, chapter list, stage select and clear screens, never while you are packing. A full-screen ad may occasionally appear when you leave the clear screen\n• Vibration can be turned off\n• No login. Your stars and records are saved on your device. Anonymous play counts per stage (no IDs or names) help us tune difficulty; you can turn this off'),
 'kakezan': dict(
  name='Mental Math Runner: Gate Rush',
  sub='Add & multiply in 200 stages',
  promo='Left or right? Is ×2 or +13 bigger right now? Do quick mental math on the run, grow your number and reach the goal. 200 stages, plus a new daily course with a ranking.',
  desc='Mental Math Runner: Gate Rush is a simple running game where you do mental math on the move. Two math gates appear side by side - run through the one that makes your number bigger, and keep growing it all the way to the goal.\n\nHOW TO PLAY\n• Tap the left or right half of the screen to choose a gate\n• + and × gates make your number grow; − and ÷ gates make it shrink\n• Reach the goal to clear the stage. The bigger your final number, the more stars you earn (up to 3 per stage)\n• If your number drops to 0 or below, you\'re out\n\n200 STAGES\nThe first stages use small additions and subtractions. Later you\'ll meet ×, ÷, bigger numbers and "deadly gates". From stage 101 there are longer courses, ×6-×9 and ÷6-÷9 gates, tougher deadly gates and faster speeds.\n• Deadly gate: one side knocks you out instantly. Compare your number with the gate and pick the side that keeps you above 0\n• Taking the smaller gate early can leave you short when a big "−" gate comes later\nCourses never change, so you can retry as often as you like and find the best route.\n\nDAILY STAGE\nA very long course that changes every day at midnight Japan time - the same course for every player. It starts easy and gets harder and faster. See how far you can go and compare the number of gates you passed. You can also run past days\' courses from a calendar (not ranked).\n\nRANKING\nCompare today\'s daily stage, this week\'s total and your total stars with all players, using just a nickname. No account or sign-in needed. Your nickname and records are sent only if you choose a nickname, and you can delete them from the ranking screen at any time.\n\nLANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\nOTHER\n• When you\'re out, you can watch a short video ad to continue once from that spot (optional). The daily ranking uses your record from before the revive\n• Pause or restart at any time with the pause button at the top left\n• Optional daily reminder at 7 pm when a new daily stage arrives (you can turn it off any time)\n• Banner ads appear on the title, stage select and result screens, never while you are running. A full-screen ad may occasionally appear when you leave the result screen\n• Vibration can be turned off\n• No login. Your progress is saved on your device. Anonymous play counts per stage (no IDs or names) help us tune difficulty; you can turn this off'),
 'jimidrive': dict(
  name='Make 10 Drive: License Plates',
  sub='Mental math on a night highway',
  promo="Can the 4 digits on a passing car's license plate make 10? Decide in seconds on a night expressway across Japan. Prime mode, time attack and a new daily drive.",
  desc='Can you make 10 from the license plate of a passing car?\n\nMake 10 Drive is a mental math game set on a Japanese expressway at night. Oncoming cars show 4-digit license plates, and you decide in a few seconds whether those four numbers can make 10 - the classic "make ten" puzzle people in Japan play with train tickets and car plates.\n\nHOW TO PLAY\n• The plate of each passing car is shown large\n• Use each of the 4 digits once, with + − × ÷ and parentheses, to try to make 10\n• Tap one of two buttons: "I can make 10" or "Impossible"\n• Correct answers bring you closer to your destination. After each answer, the app shows a formula that makes 10\n\nMORE MODES\n• Prime mode: is the 4-digit number a prime?\n• Mix: each plate asks either "make 10?" or "prime?"\n• Time attack: race to your destination against the clock\n• Endless: keep driving, turning around at the end of the line, until you run out of misses\n• Choose 1, 3 or 5 allowed misses\n\nDAILY DRIVE & RANKING\nOne course that changes every day: every player gets the same plates in the same order. Only your first run of the day counts for the ranking. Compare today\'s rank and this week\'s total with all players, plus a ranking for the number of places you\'ve reached. Only the nickname you choose and your records appear. You can also replay past days\' drives from a calendar (not ranked).\n\nACROSS JAPAN, STARTING FROM TOKYO\nAt first you can only start from Tokyo. Each destination you reach becomes a new starting point: reach Haneda for the bayshore route, Yokohama for the Tomei Expressway, Nagoya to head for Kansai, and enough places to unlock Hokkaido. The time of day (night, evening, morning, daytime) follows your clock.\n\nLOCAL NOTES & COLLECTION\nReaching a destination shows a short note about local food, sights or the origin of the place name, and little bits of trivia appear along the way. Car types you\'ve solved (sedans, kei cars, taxis, trucks, patrol cars, classic cars and more), local plates, special numbers like repeated digits, places reached and notes all go into your collection.\n\nLANGUAGE\nThe game itself is easy to play without reading Japanese, but menus, place names and the local notes are in Japanese for now.\n\nOTHER\n• No login. Your records (bests, collection, unlocked places) are saved on your device; your nickname and records are sent only if you join the ranking\n• Banner ads appear on the title and menu screens, never while you are driving. A full-screen ad may occasionally appear when you leave the result screen\n• When you run out of misses, you can watch a short video ad to continue once (optional)\n• Optional daily reminder at 7 pm when a new daily drive arrives\n• Vibration can be turned off. Anonymous play counts (no IDs or names) help us tune difficulty; you can turn this off'),
 'yudetamago': dict(
  name='Boiled Egg Peeling: Tsurutto',
  sub='Crack the shell, peel it clean',
  promo='A perfectly peeled boiled egg feels so good. Crack the shell, peel slowly, keep the white intact. Collect 18 eggs - quail, dinosaur, golden and more - plus a daily egg.',
  desc="Just the shell - smooth and clean.\n\nTsurutto is a 3D game all about peeling a boiled egg perfectly.\n\nHOW TO PLAY\n• Tap the shell to crack it (tap too much and...)\n• Drag from a crack to peel. Too fast or a sharp turn, and you'll tear the white\n• Drag on an empty area, or use two fingers, to turn the egg\n• Peel off all the shell to finish. You're ranked SSS to F by time and how clean the white is\n\n18 EGGS TO COLLECT\nWhite, brown, quail, silkie, cherry-blossom dyed, Easter egg, dinosaur egg, ostrich, century-egg style, golden, moon, a rare egg with something inside, blue, cow-print, onsen egg, chocolate-colored, black and ice. Each egg has its own number of shell pieces, hardness and fragility. The more you peel, the more eggs you meet.\n\nMORE WAYS TO PLAY\n• Daily egg: a different egg every day (midnight Japan time). Sometimes it's a rare egg you haven't met yet\n• Extra-hard soft-boiled mode: the white tears easily, and if you dig too deep you'll see the yolk\n• Once in a while, there's a surprise inside...\n• From December 1 to 25, the daily egg becomes a limited Christmas egg\n\nRANKING\n• Daily score: everyone peels the same egg of the day. Play as many times as you like - your best score of the day is ranked\n• Smoothness score (this week / all time), flawless time (the fastest peel without damaging the white), and total eggs peeled\nCompare with all players using just a nickname. No account or sign-in needed. Your nickname and records are sent only if you choose a nickname, and you can delete them from the ranking screen at any time.\n\nONE MORE CHANCE\nIf the egg explodes or the white crumbles, you can watch a video ad to continue that egg once (optional; continued eggs are not ranked).\n\nLANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\nOTHER\n• Pause, restart or go back to the title any time with the pause button at the top left\n• Banner ads appear on the title and result screens, never while you are peeling. A full-screen ad may occasionally appear when you leave the result screen\n• Vibration can be turned off\n• No login. Your records are saved on your device. Anonymous play counts (no IDs or names) help us tune difficulty; you can turn this off"),
 'nattofilm': dict(
  name='Natto Peel: Sticky Strings',
  sub='Peel slowly, wind every string',
  promo='Can you peel the film off a natto pack without snapping the sticky strings? Lift it slowly, pull them tight, then wind them all up. 10 kinds of natto and a daily natto.',
  desc="That thin film on a pack of natto at breakfast - can you peel it off cleanly?\n\nNatto Peel is a 3D time-attack game: peel the film off a pack of natto (Japanese fermented soybeans) and wind up every sticky string as fast as you can.\n\nHOW TO PLAY\n• Pinch the glowing corner and lift slowly to peel off the film\n• Once it's off, lift it high to pull the strings tight\n• Move in circles to wind the strings up\n• Pull too hard and strings snap - that's a time penalty. Beans stuck to the film cost time too\n\n10 KINDS OF NATTO\nSmall bean, chopped (hikiwari), large bean, black bean, straw-wrapped, green soybean, extra-large, snow-chopped and more. Each kind is different in how the strings form, how easily they snap and how easy they are to wind. Play more to meet new kinds and fill your natto collection.\n\nMORE WAYS TO PLAY\n• Daily natto: a different kind every day (midnight Japan time). Sometimes it's one you haven't met yet\n• 3-pack streak: peel three packs in a row for a total time\n• Ranks S to C and 12 achievements\n\nRANKING\n• Daily score: everyone peels the same natto of the day. Play as many times as you like - your best score of the day is ranked\n• Fastest single-pack time (adjusted for each kind's difficulty), this week and all time, plus total strings wound up\nCompare with all players using just a nickname. No account or sign-in needed. Your nickname and records are sent only if you choose a nickname, and you can delete them from the ranking screen at any time.\n\nLANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\nOTHER\n• Pause, restart or go back to the title any time with the pause button at the top right\n• Banner ads appear on the title and result screens, never while you are playing. A full-screen ad may occasionally appear after a result\n• Vibration can be turned off\n• No login. Your records are saved on your device. Anonymous play counts (no IDs or names) help us tune difficulty; you can turn this off"),
 'madoshizuku': dict(
  name='Window Drops: Relaxing Rain',
  sub='Merge raindrops with a finger',
  promo='Trace a rainy car window to gather drops and merge them into a big one. Mix rain, thunder, engine and music-box sounds, or just watch the window with a sleep timer.',
  desc="A rainy day. A car window. Blurry city lights outside.\nWindow Drops is a calm game where you gather raindrops with your finger and grow them bigger.\n\nHOW TO PLAY\n• Trace the window to collect water into a drop\n• Bump it into other drops to merge and grow\n• Big drops are heavy - move too fast and they break apart\n• Drops that reach the bottom edge run off\n• Let go, and heavy drops slide down, leaving a trail\n\n5 KINDS OF RAIN\nMist, fine drizzle, steady rain, heavy rain and a sudden downpour. The harder it rains, the faster drops grow - and the faster they run. The downpour blows sideways, with thunder. Your best is saved for each kind of rain.\n\n3 MODES\n• 60-second challenge: how big can you grow a drop in 60 seconds? Watch out for the wiper\n• Relaxed mode: no timer, no wiper. Watch the rainy window as long as you like\n• Sleep rain sounds: just watch the window while the rain sounds play. A 15-90 minute timer slowly fades them out. The screen stays on in this mode\n\nMIX YOUR OWN RAIN SOUNDS\nRain, drops hitting the glass, thunder, a car engine and turn signal, and a music box - each with its own volume. All sounds are generated in the app.\n\nNEW VIEWS OUTSIDE THE WINDOW\nGrow bigger drops to unlock new scenes: night city, evening highway, tunnel, snowy night, neon streets, cherry blossoms at night, fireworks and more - 12 scenes in all. From December 1 to 25, the daily rain becomes a limited snowy window.\n\nTHINGS TO COLLECT\n• Postcards: make a drop larger than 11 mm to receive a postcard of the city reflected in it\n• Rainy-day diary: each day you play is saved with its rain, scene and biggest drop\n• Daily rain: a different rain and goal every day\n• Badges and 8 drop-size ranks in the drop collection\n\nRANKING\nCompare the biggest drop from your 60-second challenge with all players (this week / all time), plus your total merges. No account or sign-in needed. Your nickname and records are sent only if you choose a nickname, and you can delete them from the ranking screen at any time.\n\nLANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\nOTHER\n• Mute all sounds with the button at the top right\n• No connection needed to play. Ranking records are sent when you're online\n• Your records are saved on your device. Anonymous play counts (no IDs or names) help us tune difficulty; you can turn this off\n• Banner ads appear on the title and result screens only - never during play or sleep rain sounds\n• Vibration can be turned off"),
 'hensokushogi': dict(
  name='Shogi Variants: Play Online',
  sub='Annan, card rules & 2250 tsume',
  promo='Play variant shogi online with friends via a room code - no account needed. Annan, card shogi, restriction shogi and more, plus a CPU from 10-kyu to 5-dan.',
  desc='Shogi Variants: Play Online is shogi (Japanese chess) with a twist. Play variant rules online with friends, against the CPU, or with two players on one iPhone. It also includes 2250 variant tsume (checkmate) problems.\n\nPLAY ONLINE WITH FRIENDS\n• Create a room and send the 6-character room code or an invite link to a friend. Your friend installs this free app and enters the code. No account or login\n• Private rooms are hidden from the room list; in public rooms anyone can send a join request\n• You play only with players you accept as the host\n• Time controls: none, sudden death, main time + byoyomi, byoyomi only, or Fischer\n• If the connection drops, return to the same room to continue\n• Review the game record afterwards (your last 5 online games are saved)\n\nRULES\n• Annan, Anhoku, Anto and Anzai shogi: a piece borrows the moves of the friendly piece right behind it (or in front of it, or to its right or left, depending on the rule). 9×9 and 5×5 boards, with an optional "capture the king" setting\n• Card shogi: you can only move a piece on the file shown by the card you draw. When in check, you can move freely without using a card. Hold 0-3 cards, or draw first\n• Restriction shogi: regular shogi with handicaps such as "you can\'t enter the enemy camp until you\'ve built a Mino castle" or "your king can\'t move until you\'re checked". Pick 1-3 restrictions from castles, openings and move rules. Moves that break them can\'t be played, and when you\'re in check you can play freely. Keep your opponent\'s restrictions secret until the end, try 12 challenges, or play it online\n• Effect card shogi: regular shogi with 13 one-time special cards, such as two moves in a row\n• Check shogi: the first player to give check wins\n• Decoy shogi: secretly choose one of your pieces as a decoy; capture your opponent\'s decoy to win. It stays hidden online too\n• Regular shogi\n\nCPU WITH 10 LEVELS\nFrom 10-kyu to 5-dan, for beginners and experienced players alike. Choose to move first or second. In regular shogi, the CPU knows common openings (Yagura, Kakugawari, Shikenbisha, Nakabisha, Mino and Anaguma castles and more) and always finds a mate when there is one. Ratings are kept per rule.\n\n2250 VARIANT TSUME PROBLEMS\n9×9 checkmate problems in the Annan, Anhoku, Anto and Anzai rules - you need the borrowed moves to solve them.\n• 1901 strict tsume problems (1 to 15 moves, beginner to very hard), plus practical mates and real-game positions\n• Solve on the board, or read the moves without moving the pieces\n• Choose the defender\'s replies yourself, or hide the number of moves\n• After solving, study other defenses in analysis mode\n• Tsume grading test (10-kyu to 7-dan)\n• 3 free hints per day across all problems; watch a short video for 3 more (optional)\n\nLANGUAGE\nMenus, rule explanations and in-game text are in Japanese for now. Pieces use the standard kanji.\n\nOTHER\n• Everything except online play works offline\n• No login. Records stay on your iPhone. Online, only a short nickname is shown; names are filtered and can be reported or hidden\n• Banner ads appear on menus and CPU games, never during online games. A full-screen ad may occasionally appear after CPU games. Video ads are always optional (extra hints, answers or undos)\n• Sound and vibration can be turned off'),
 'pokerstudy': dict(
  name='Poker Preflop Practice Quiz',
  sub="Learn Texas Hold'em decisions",
  promo='See your two cards and your seat, then choose fold, call or raise. Each answer shows the reason and a 13×13 range chart. Flop, turn and river quizzes and CPU tables too.',
  desc='Poker Preflop Practice Quiz is a study app for Texas Hold\'em decisions, one question at a time. Look at your two cards and your seat, decide whether to play and how, then check the reason and the range chart. Start with the first decision (preflop), and move on to flop, turn and river questions when you\'re ready.\n\nAll scores and points in the app are practice points for tracking your progress. They can\'t be bought, exchanged for anything or sent to anyone, and there are no in-app purchases.\n\nQUIZ PRACTICE\n• Choose what to practice: preflop, flop, turn & river, or a mix\n• Preflop: see the seat diagram, the earlier players\' actions and your two cards, then choose fold, call or raise\n• Flop: as the preflop raiser, choose check, 33% or 75% of the pot; when an opponent leads, choose fold, call or raise\n• Turn & river: keep up the pressure or not, bluff-catching calls, and numbers like the equity you need to call and MDF\n• Four grades of feedback (correct / correct with a mixed hand / OK / miss), with a bar of action frequencies, a short reason and a 13×13 range chart\n\nFIX YOUR WEAK SPOTS\n• Position practice: focus on one seat (UTG, HJ, CO, BTN, SB, BB)\n• Weak hands: hands you missed come back right away, then after 5 minutes, 1 hour and 1 day\n• Build a spot: choose the number of players (2-9), stack (10-100 BB), your seat and earlier actions to see a suggested range, and practice just that spot\n• Stats: overall accuracy plus accuracy by position, situation and board type, and a list of your weak hands\n\nPRACTICE TABLES VS CPU (OFFLINE)\n• Practice tournaments: choose 2 to 500 players, the starting stack and how fast the blinds rise, and play against CPU players only\n• Practice ring games: the blinds stay the same and play continues, against CPU players only\n• Every decision comes with an explanation that considers stack depth and how close you are to the final places, plus a range chart. Afterwards, a review shows what went well, what to focus on next, and each hand\n• Choose "preflop only" or "flop and beyond"\n• Fast fold: decide to fold early while others act, and still see the explanation during the next hand (not offered preflop in the big blind)\n• The action buttons always stay in the same place (fold, check/call, raise, all-in) to prevent mis-taps\n• Challenge mode: track your practice points across set tournaments and ring games. Practice points are only a progress score; if they run out, you can start over\n• 5 CPU levels: stronger CPU players follow the range charts more closely\n\nPRACTICE RANKING\n• Compare your practice points in challenge mode and this week\'s correct quiz answers with other players, using a nickname\n• Only players who choose a nickname take part. Only the nickname and practice results are sent, and you can remove your records at any time\n\nABOUT THE RANGES (HONESTLY)\nThe charts are simplified, easy-to-remember versions of commonly taught 6-max, 100 BB ranges. They are guidelines, not exact solver output. Answers for the flop and later streets are also guidelines from this app\'s own equity model.\n\nLANGUAGE\nMenus, explanations and in-game text are in Japanese for now. Position names (UTG, BTN, BB...) and hands (AKs, 75o...) are written in English letters.\n\nOTHER\n• No login. Your records are saved on this iPhone (if you join the ranking, only your nickname and practice results are sent)\n• Banner ads appear at the bottom of the home, seat select, range chart and stats screens - never while you answer a question or play at a practice table. A full-screen ad may occasionally appear at a break point\n• Sound and vibration can be turned off in Settings\n• Anonymous play counts (no IDs or names) help us improve the questions; you can turn this off'),
 'gekokujo': dict(
  name='Gekokujo Duel: 1 Beats 9',
  sub='Number card mind game for two',
  promo="Play cards 1-9 one by one - the higher number wins, but 1 beats 9! Your opponent's cards stay hidden, so read them and pick your moments. Quick matches vs CPU or friends.",
  desc='Higher number wins. But 1 beats 9.\n\nGekokujo Duel is a two-player number card game about reading your opponent. ("Gekokujo" is a Japanese word for the lowly overthrowing the mighty.) You can learn the rules in 30 seconds, and the more you read your opponent, the deeper it gets.\n\nHOW TO PLAY\n• Each player has one card of each number from 1 to 9\n• Each round, both players play one card face down. The higher number wins 1 point\n• But 1 beats 9 - gekokujo!\n• The winner of the previous round plays first; the other player plays after the first card is down\n• Used cards don\'t come back. You never see which numbers your opponent played - only who won each round\n• After 9 rounds, the player with more points wins\n\nONE-TIME SPECIAL CARDS\n• Peek: when playing second, see the number on the first player\'s card (from round 2)\n• Double: the winner of this round gets 2 points\n• Guard: if you lose this round, it\'s a draw instead\nWhether your opponent used a special card stays secret during the match, and so do the points - you only see rounds won.\n\nWhen do you play your 9? Do you keep your 1 to catch their 9? Where do you use Double? Every match plays out differently.\n\nRANK UP TO MEIJIN\nBeat 10 rivals with different styles one by one, from 10-kyu "Tamago" up to Meijin (master). One loves Double, one loves Guard, a cat goes for the gekokujo... reading their habits is part of the strategy.\n\nDAILY CHALLENGE\nA new challenge every day, like "Win with a gekokujo" or "Win without special cards". Keep your streak going, and play past days\' challenges too.\n\nACHIEVEMENTS & SKINS\n15 achievements, such as your first gekokujo, a perfect win or a big comeback. They unlock new card backs (waves, cherry blossoms, checkers, starry sky, gold leaf and more) and table colors.\n\n3 WAYS TO PLAY\n• vs CPU: ranked matches, the daily challenge and free play (easy, normal, strong)\n• 2 players on one iPhone: take turns, with a hand-over screen each round so your cards stay hidden\n• Online: create a room and accept join requests, or invite a friend to a private room with a 5-character code or invite link. No sign-up or login. Say hi with preset stamps\n\nAFTER THE MATCH\nA review table shows every card both players played, where special cards were used, and the points. Share the result as an image.\n\nREADING HINTS (CPU MATCHES)\nSee which cards your opponent probably has left and your chance of winning with each of your cards. Once per match: free once a day, then by watching an optional short video.\n\nLANGUAGE\nThe rules are simple and the game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\nOTHER\nNo login. CPU and 2-player games work offline, and your records are saved on your device. Ads appear on the title and result screens, never during a match. Online, only a short nickname is shown; names are filtered and can be reported or hidden.'),
 'futaridaifugo': dict(
  name='Futari Daifugo: 1v1 Daihinmin',
  sub='President card game for two',
  promo="Split a deck into red and black for one-on-one Daifugo. Read what's left from the cards played. 5 Skip, 7 Pass, 8 Cut, 10 Discard, Revolution and more - vs CPU or online.",
  desc='Daifugo (also called Daihinmin - a Japanese card game similar to President) for two players, one on one.\n\nThe 52 cards (no jokers) are split into red (hearts and diamonds) and black (spades and clubs), one color per player. Both hands have two of every number, so the deal is fair. You can\'t see your opponent\'s hand, but if you remember the cards played, you can work out what\'s left. When to use your strong cards and when to pass - it\'s a game of reading each other.\n\nHOW TO PLAY\n• Card strength goes 3, 4, ... K, A, 2 (2 is the strongest)\n• Play one card, or 2-4 cards of the same number together\n• When there are cards on the table, play the same number of cards with a higher number, or pass\n• When your opponent passes, the table is cleared and the last player to play leads\n• The first player to empty their hand wins\n\nSPECIAL CARDS\n• 5 Skip: skip your opponent\'s turn and play again\n• 7 Pass: give your opponent cards of your choice, as many as you played\n• 8 Cut: clear the table and lead again\n• 10 Discard: discard cards of your choice, as many as you played\n• Jack Back: playing a J reverses card strength until the table is cleared\n• Revolution: four of the same number reverse card strength (7 Pass moves cards around, so four of a kind can happen)\n\nCARDS YOU CAN\'T FINISH WITH\nYour very last play can\'t be the strongest number (usually 2), a 5, 7, 8, 10 or J, or a revolution. Use your special cards early!\n\nMODES\n• vs CPU: easy, normal or strong. One game decides the match\n• Online: create a room and wait, or send a join request to a waiting room; the game starts when the host accepts. Invite friends to a private room with a 5-character code or an invite link\n• Preset stamps (10 kinds) during play\n\nLANGUAGE\nMenus and rule explanations are in Japanese for now; the cards are standard playing cards.\n\nOTHER\n• The rules are always available in the app (on the title screen, and the "?" button during play)\n• No login. Online, only a short nickname is shown; names are filtered and can be reported or hidden\n• Banner ads appear on the title and result screens, never during play. A full-screen ad may occasionally appear after CPU games\n• Anonymous play counts (no IDs or names) help us improve; you can turn this off'),
}

# 2026-11-22 追加の6本（審査中・公開前）。英語の App Store の文はまだないので、日本語の App Store の文（AppStore.md）から訳した文。
# ページの下の「Text from the English App Store description」のかわりに「Translated from the Japanese ...」と出す（FROM_JA）
FROM_JA = ('nazotte10', 'rittai', 'gunjin', 'tsurunobori', 'furikonobori', 'soranokaidan')

SHOT_ALT_EN.update({
    'nazotte10': {'1_battle': 'Tracing neighboring numbers to make 10 and attack an enemy', '2_boss': 'A boss battle at the end of a chapter',
                  '3_terrain': 'The snowy mountain chapter with icy tiles', '4_ally': 'Choosing a defeated enemy as a companion', '5_book': 'The monster book'},
    'rittai': {'1_play': 'Dropping red and blue balls onto the 4×4 board of poles', '2_win': 'Four in a row using height and a diagonal',
               '3_online': 'Creating a room to play a friend online', '4_stamp': 'Saying hi with a stamp during a game', '5_title': 'Title screen'},
    'gunjin': {'1_battle': 'A battle with a hidden enemy piece - only the result is shown', '2_place': 'Setting up 23 pieces in your camp',
               '3_online': 'Playing a friend online with a room code', '4_chart': 'The chart of which piece beats which', '5_reveal': 'All pieces revealed after the game'},
    'tsurunobori': {'1_play': 'The glowing line passing Tokyo Tower', '2_space': 'Near space at 100 km, with the blue Earth below',
                    '3_moon': 'The line reaching toward the Moon, 384,400 km up', '4_record': 'The result screen with the whole line and your record',
                    '5_kisekae': 'Choosing line colors and tips'},
    'furikonobori': {'1_play': 'A glowing ball swinging like a pendulum in the night sky', '2_space': 'Near space at 100 km, with the blue Earth below',
                     '3_moon': 'Climbing close to the Moon, 384,400 km up', '4_record': 'The result screen with landmarks and your record',
                     '5_kisekae': 'Choosing ball colors and strings'},
    'soranokaidan': {'1_play': 'Placing keys under the bouncing note with a row of "Perfect!" taps', '2_songs': 'The xylophone title and the list of 10 songs',
                     '3_result': 'The result screen showing the notes you played on a staff', '4_medley': 'The medley mode, where the 10 songs play in a row',
                     '5_kisekae': 'Choosing a sound: piano, music box, marimba and more'},
})

HEAD_EN.update({'8 CHAPTERS TO EXPLORE': '8 chapters to explore', 'THE APP IS THE REFEREE': 'The app is the referee',
                'PAST LANDMARKS, INTO SPACE, TO THE MOON': 'Past landmarks, into space, to the Moon'})

_CLIMB_COMMON = (
    "PAST LANDMARKS, INTO SPACE, TO THE MOON\n"
    "The view changes as you climb: city buildings, mountains, above the clouds, the starry sky and the blue Earth. "
    "Pass Tokyo Tower (333 m), Tokyo Skytree (634 m), Mt. Fuji (3,776 m), the stratosphere, space (100 km), the International Space Station and finally the Moon (384,400 km). "
    "A message pops up each time you pass a landmark, and \"Next: Mt. Fuji in ○ m\" always shows your next goal.\n\n"
    "SKINS YOU UNLOCK BY PLAYING\n"
    "{skins} New skins unlock as you pass landmarks, climb a lot and play every day. They can't be bought with ads or money.\n\n"
    "PICK YOUR MUSIC\n"
    "The original music is generated in the app. On \"Auto\" the tune changes with your height, or choose gentle, upbeat, night or space - or no music. Sound effects and vibration can each be turned off.\n\n"
    "RANKINGS\n"
    "Compare your best height today, this week and all time. No sign-in - just choose a nickname. Nothing is sent unless you choose one, and you can delete your records any time.\n\n"
    "LANGUAGE\n"
    "The game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\n"
    "OTHER\n"
    "• Your records and skins are saved on your iPhone. No connection needed to play (only the rankings go online)\n"
    "• Banner ads appear on the title and result screens, never during play. After a few games, a full-screen ad sometimes appears on the result screen\n"
    "• When you fall, you can watch an optional video ad to continue once from where you fell")

STORE_EN.update({
 'nazotte10': dict(
  name='Nazotte 10: Math Dungeon Puzzle',
  sub='Make 10 to defeat monsters',
  promo='Trace neighboring numbers to make exactly 10 and attack the enemy. Watch its next move and choose which 10 to clear first. Travel through 8 chapters and beat the final boss.',
  desc="Trace numbers to make exactly 10. A puzzle RPG where addition defeats monsters.\n\n"
       "Trace the number tiles 1-9 on the board in one stroke without lifting your finger. When the total is exactly 10, the tiles vanish and hit the enemy. A 10 made from 2 tiles or from 5 tiles both count - the more tiles you use, the stronger the attack.\n\n"
       "HOW TO PLAY\n• Trace from tile to tile - up, down, left, right or diagonal\n• When the total is exactly 10, the tiles clear and you attack\n"
       "• When the gauge around an enemy's face fills up, it does the \"next move\" shown on screen\n"
       "• Time stops until you clear your first 10 and after each enemy move, so you can look at the board calmly\n"
       "• There is always at least one 10 you can make on the board\n• Stuck? Use a magnifying glass item to see a hint\n\n"
       "SPECIAL TILES\n• Star: double damage\n• Shield: blocks an enemy attack\n• Heart: restores HP\n• Rock: breaks when you make a 10 next to it\n\n"
       "8 CHAPTERS TO EXPLORE\nForest path, mountain cave, night castle, rocky shore, snowy mountain road, sand ruins, sky island and the candy land. Each chapter has new enemies and terrain, with a boss waiting at the end - plus shops, rest stops and treasure chests along the way.\n\n"
       "GET STRONGER\n• Earn stars from defeated enemies and cleared chapters, and use them to raise max HP, attack, defense and more\n"
       "• Defeated enemies can join you as companions, each with one special skill\n• Clearing a chapter can give you an item - equip one before you set out\n"
       "• Your hero levels up with every adventure\n• Open mystery boxes with medals to get companions, items and new hero faces\n"
       "• Slow the enemy gauge with Time, hit harder with Power, or protect yourself with Guard. Find a combination for the harder chapters\n\n"
       "MONSTER BOOK\nEvery monster you defeat goes into the book. Collect the cute, slightly creepy monsters.\n\n"
       "LANGUAGE\nThe rules are simple and the game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\n"
       "OTHER\n• No account needed. Your records are saved on your iPhone\n• Ads appear at the bottom of screens such as the title and map, never during battles\n• When you lose, you can watch an optional video to revive once"),
 'rittai': dict(
  name='3D Four in a Row Online',
  sub='Line up 4 in 3D with friends',
  promo='Drop red and blue balls onto 16 poles on a 4×4 board. Line up 4 across, down, up or diagonally to win. Rotate the board and watch for your rival\'s threats. Play the CPU, a friend on one phone, or online.',
  desc="Across, down, up and diagonal. A two-player game of four in a row - in 3D.\n\n"
       "16 poles stand on a 4×4 board. Red and blue take turns dropping one ball at a time. Balls stack from the bottom, up to 4 on each pole. Line up 4 of your color in a straight line to win. There are 76 possible lines in all, including diagonals on each level and diagonals through the whole cube - some of them are easy to miss from any angle.\n\n"
       "HOW TO PLAY\n• Tap a pole to select it, then tap again to drop the ball to the bottom (so you don't drop one by mistake). You can switch to one-tap dropping in Settings\n"
       "• Rotate the board by swiping or with the rotate buttons, or view it from almost straight above\n"
       "• The last ball played has a glowing ring, and a winning line lights up\n"
       "• Careful: if you play on a pole below your opponent's winning spot, they can drop right on top of it\n\n"
       "WAYS TO PLAY\n• vs CPU: easy, normal or strong. Play first, second or random, and take back moves to your own turn\n• 2 players on one iPhone: take turns\n"
       "• Online: create a room and wait, or ask to join a waiting room - the game starts when the host accepts. Invite a friend to a private room with a 6-character code. Time limits: none, 30 seconds per move, or 3 minutes per player\n"
       "• Say hi with 9 preset stamps during a game\n\n"
       "RECORDS\nWins, losses and draws for each CPU level, your best winning streak, your fastest win and your online record.\n\n"
       "LANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\n"
       "OTHER\nNo account needed. Online, only a short nickname you choose is shown to your opponent, and you can report or hide names. Ads appear on the title and result screens, never during a game."),
 'gunjin': dict(
  name='Gunjin Shogi Online (Military Shogi)',
  sub='Hidden pieces - the app is the referee',
  promo='You can\'t see what your opponent\'s pieces are or where they stand. When pieces clash, you only learn win, lose or draw. Gunjin Shogi usually needs a referee - here the app is the referee.',
  desc="Gunjin Shogi (\"military shogi\") is a Japanese board game of hidden pieces and mind games. The app is the referee, so just two players can play.\n\n"
       "In Gunjin Shogi, neither player knows what the other's pieces are. Normally a third person has to act as referee - here, the app does it. When your piece runs into an enemy piece, you are told only whether you won, lost or both were removed. Which piece looks strong? Where might the mines be? Read your opponent's setup from the results of each battle.\n\n"
       "HOW TO PLAY\n• The board is 6 wide and 8 deep. The 4 rows on your side are your camp\n"
       "• First, place your 23 pieces in your camp. Pick a template (balanced, attack, defense or random), then tap two pieces to swap them\n"
       "• Most pieces move 1 square forward, back or sideways. Tanks and cavalry move 2 squares, engineers move any distance, and planes can jump over pieces forward and back. Mines and the flag can't move\n"
       "• When you move into an enemy piece, they battle. The stronger piece stays; if they're the same, both are removed\n"
       "• Win by moving an officer from major up to general into the enemy headquarters, or when your opponent has no pieces left to move\n\n"
       "PIECES (23 PIECES, 16 KINDS)\nGeneral, lieutenant general, major general, colonel, lieutenant colonel, major, captain, first lieutenant, second lieutenant, plane, tank, cavalry, engineer, mine, spy and flag. The spy beats the general, and a mine loses only to planes and engineers. A battle chart with piece pictures shows which piece beats which at any time.\n\n"
       "THE APP IS THE REFEREE\n• Only your own pieces are shown. The type and position of enemy pieces never appear on screen\n"
       "• You only learn where a battle happened and whether you won, lost or drew\n• When the game ends, all enemy pieces are revealed\n\n"
       "WAYS TO PLAY\n• vs CPU: easy, normal or strong. The CPU also sees only its own pieces and the battle results - no cheating\n"
       "• 2 players on one iPhone: a hand-over screen appears every turn so you never see your opponent's pieces\n"
       "• Online: create a room and wait, or ask to join a waiting room - the game starts when the host accepts. Invite a friend to a private room with a 6-character code\n"
       "• Time controls: 3 or 10 minutes per player, 10 or 30 seconds per move, or 5 minutes + 5 seconds per move (CPU and 2-player games can also have no clock). The clock stops during setup\n"
       "• Say hi with 9 preset stamps during a game\n\n"
       "LANGUAGE\nMenus and in-game text are in Japanese for now. The battle chart uses piece pictures, and this page explains the rules in English.\n\n"
       "OTHER\nNo account needed. Online, only a short nickname you choose is shown to your opponent, and you can report or hide names. Ads appear on the title and result screens, never during a game."),
 'tsurunobori': dict(
  name='Vine Climb',
  sub='Hold to steer a line to the Moon',
  promo='The glowing line keeps growing upward. While you hold, it bends toward your finger - dodge the red obstacles and climb as high as you can: Tokyo Tower, Mt. Fuji, space and the Moon. Pass landmarks to unlock skins.',
  desc="Grow a line of light higher and higher. A climbing game you play just by holding the screen.\n\n"
       "HOW TO PLAY\n• The glowing line (the vine) keeps growing upward\n• While you hold the screen, the tip heads toward your finger's left-right position. Let go and it grows straight up\n"
       "• Touch a red bar or ring and it's over\n• The higher you go, the faster it gets and the more obstacles appear\n• When it's over, your whole line becomes one picture\n\n"
       + _CLIMB_COMMON.format(skins='Choose the line color, thickness, glow, tip and background (27 in all).')),
 'furikonobori': dict(
  name='Pendulum Climb',
  sub='Tap to swing up into space',
  promo='A glowing ball hangs from a point and swings. Tap to let go and hook onto a higher point. The best moment is when it swings up with speed. Stay ahead of the rising mist and climb into space and to the Moon.',
  desc="Swing, hook and climb higher. A pendulum game you play with just a tap.\n\n"
       "HOW TO PLAY\n• A glowing ball hangs from a point on a string and swings\n"
       "• Tap to let go and hook onto the nearest higher point within reach. Points you can reach are shown with a faint dotted line\n"
       "• Hook on while swinging upward with speed, and you'll shoot up\n• Tap when no point is in reach and you let go and fall\n"
       "• Glowing mist rises from below. Touch it and it's over\n\n"
       + _CLIMB_COMMON.format(skins='Choose the ball color, trail, string, point shape and background (27 in all).')),
 'soranokaidan': dict(
  name='Oto no Kaidan: Tap a Melody',
  sub='Place keys and play famous songs',
  promo='Tap to place a key under the bouncing note and the next note of the song plays. Tap at just the right moment for a "Perfect!" and a clear tone. Play 10 songs, from Twinkle Twinkle Little Star to Canon, with your own finger.',
  desc="Every key you place plays the next note of the song. A music game where your taps perform the melody.\n\n"
       "HOW TO PLAY\n• A round note bounces while moving left and right\n• Tap to make a key under it - and the next note of the song plays\n"
       "• Tap just above the dotted line for a \"Perfect!\" - a clear, clean tone, and your next key goes 2 levels up\n"
       "• Keys are colored by do-re-mi. The circle on the left shows the next note\n• Sheet music at the bottom shows the notes you played and the ones to come\n"
       "• Touch a black key and it's over - wait until the note is on the open side, then place your key to slip through\n\n"
       "ONE SONG PER STAGE\nPlay to the last note to clear a song. More Perfects give more stars and open the next song. "
       "10 songs whose melodies are free for everyone: Twinkle Twinkle Little Star, Mary Had a Little Lamb, Ode to Joy, Jingle Bells, Fur Elise, Canon and more. "
       "The result screen shows your notes on a staff.\n\n"
       "MEDLEY\nThe 10 songs play one after another. Compare how many notes you played today, this week and all time (just choose a nickname).\n\n"
       "SOUNDS AND SKINS\nBall color, key shape (xylophone, bell, keyboard, bean), sound (piano, music box, marimba, glockenspiel, chiptune) and paper color. "
       "Unlocked by clearing songs, collecting stars and playing every day - never bought with ads or purchases.\n\n"
       "LANGUAGE\nThe game is easy to play without reading Japanese; menus and in-game text are in Japanese for now.\n\n"
       "Free with ads (never during play). Works offline; only the rankings use the network."),
})
