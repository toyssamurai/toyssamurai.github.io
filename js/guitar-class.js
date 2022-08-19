class GuitarString {
	#playedNotes = [];
	playNoteOn = function () {
		//console.log("Note On:", arguments);
	};
	playNoteOff = function () {
		//console.log("Note Off:", arguments);
	};

	constructor(guitar, stringIndex) {
		this.guitar = guitar;
		this.stringIndex = stringIndex;
	}

	get playedNotes() {
		return this.#playedNotes;
	}

	registerPlayNoteOn(callback) {
		this.playNoteOn = callback;
	}
	registerPlayNoteOff(callback) {
		this.playNoteOff = callback;
	}
	async delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	async playANote(noteToPlay, attack, release) {
		noteToPlay += this.guitar.transpose;
		//console.log("Play note# ", noteToPlay, "from string", this.stringIndex);
		await this.delay(this.guitar.bridgeDelay);
		await this.stop(0, 0);

		let now = new Date().valueOf();
		this.playNoteOn(noteToPlay, this.stringIndex, attack, release);
		this.#playedNotes.unshift({
			note: noteToPlay,
			timestamp: now
		});
		await this.delay(this.guitar.autoSustainLength);
		//console.log("Stop all notes after ", this.guitar.autoSustainLength, "ms");
		this.stop(0, 0, now);
	}

	async play(chordName, attack, release) {
		await this.delay(this.guitar.bridgeDelay);
		await this.stop(0, 0);
		if (!this.guitar.chordMap[chordName]) {
			console.log("Chord not recognize, do not play any note. Do not add the note to the playedNotes list.");
		}
		else {
			let chord = this.guitar.chordMap[chordName];
			let noteToPlay = chord.notes[this.stringIndex];
			//console.log("Play Note: ", noteToPlay, this.guitar.transpose);
			noteToPlay += this.guitar.transpose;
			let now = new Date().valueOf();
			this.playNoteOn(noteToPlay, this.stringIndex, attack, release);
			this.#playedNotes.unshift({
				note: noteToPlay,
				timestamp: now
			});
			await this.delay(this.guitar.autoSustainLength);
			//console.log("Stop all notes after ", this.guitar.autoSustainLength, "ms");
			this.stop(0, 0, now);
		}
	}

	async stop(attack = 1, release = 1, timestamp) {
		if (this.#playedNotes.length > 1) {
			// something goes wrong, there should be no more than 1 notes in this list
			for (let i = this.#playedNotes.length - 1, c = -1; i > +1; i--) {
				let playedNote = this.#playedNotes[i];
				if (!timestamp) {
					//console.log(`Stop ${playedNote.note} on string ${this.stringIndex}`);
					this.#playedNotes.splice(i, 1);
					this.playNoteOff(playedNote.note, this.stringIndex, attack, release);
				}
				else if (timestamp == playedNote.timestamp) {
					//console.log(`Stop ${playedNote.note} on string ${this.stringIndex}`);
					this.#playedNotes.splice(i, 1);
					this.playNoteOff(playedNote.note, this.stringIndex, attack, release);
				}
			}
		}
		else if (this.#playedNotes.length > 0) {
			let playedNote = this.#playedNotes[0];
			if (!timestamp) {
				//console.log(`Stop ${playedNote.note} on string ${this.stringIndex}`);
				this.#playedNotes.splice(0, 1);
				this.playNoteOff(playedNote.note, this.stringIndex, attack, release);
			}
			else if (timestamp == playedNote.timestamp) {
				//console.log(`Stop ${playedNote.note} on string ${this.stringIndex}`);
				this.#playedNotes.splice(0, 1);
				this.playNoteOff(playedNote.note, this.stringIndex, attack, release);
			}
		}
	}
}

class Guitar {
	#fretboard = [];
	#bridgeNotes = [];


	#chordTriggers = {};
	triggerToChord = {};

	#specialNotes = {
		mutedNote: {
			trigger: 126,
			noteNumber: 91,
			name: "Muted Note"
		},
		silentStroke: {
			trigger: 127,
			noteNumber: 92,
			name: "Silent Stroke"
		},
		strumFull: {
			trigger: 119
		},
		strumBass: {
			trigger: 118
		},
		strumMid: {
			trigger: 117
		},
		strumTreble: {
			trigger: 116
		}
	};

	#chordMap = {};

	#chordState = {
		noteOnNumbers: [],
		currentChordName: "OPEN"
	};
	#strumState = {
		direction: "down"
	};
	#stringState = {
		lastPlayedString: -1,
		strings: [
			{
				lastNoteAction: "", // on or off
				lastAttack: -1, // 0 - 127
				lastRelease: -1, // 0 - 127
			},
			{
				lastNoteAction: "", // on or off
				lastAttack: -1, // 0 - 127
				lastRelease: -1, // 0 - 127
			},
			{
				lastNoteAction: "", // on or off
				lastAttack: -1, // 0 - 127
				lastRelease: -1, // 0 - 127
			},
			{
				lastNoteAction: "", // on or off
				lastAttack: -1, // 0 - 127
				lastRelease: -1, // 0 - 127
			},
			{
				lastNoteAction: "", // on or off
				lastAttack: -1, // 0 - 127
				lastRelease: -1, // 0 - 127
			},
			{
				lastNoteAction: "", // on or off
				lastAttack: -1, // 0 - 127
				lastRelease: -1, // 0 - 127
			}
		]
	}

	noteToKey = {};
	keyToNote = {};

	chordOnDelay = 35;
	chordOffDelay = 35;
	bridgeDelay = 10;
	strumDelay = 35;
	tempo = 90;
	autoSustainLength = 1000;
	transpose = 0;

	doSendPressure = false;
	doSendPitchBend = false;
	useBuiltInSound = false;
	bridgeChannel = 16;
	maxFingerBoardNoteNumber;
	minBridgeNoteNumber = 110;
	guitarStrings = [];
	strumGuitarStrings = [];


	delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	sortByNumber(a, b) {
		return a - b;
	}
	rand(min, max) {
		return (Math.floor(Math.pow(10, 14) * Math.random() * Math.random()) % (max - min + 1)) + min;
	}

	get chordName() {
		return this.#chordState.currentChordName;
	}
	get chordMap() {
		return this.#chordMap;
	}
	get chordState() {
		return this.#chordState;
	}
	get lastPlayedString() {
		return this.#stringState.lastPlayedString;
	}
	get stringState() {
		return this.#stringState;
	}

	set guitarStrings(guitarStrings) {
		this.guitarStrings = guitarStrings;
	}

	constructor(settings) {
		this.reloadSettings(settings);
	}

	reloadSettings(settings) {
		this.#fretboard = settings.fretboard;
		this.#chordTriggers = settings.chordTriggers;
		this.#bridgeNotes = settings.bridgeNotes;

		let maxFingerBoardNoteNumber = this.#fretboard[this.#fretboard.length - 1];
		this.maxFingerBoardNoteNumber = maxFingerBoardNoteNumber[maxFingerBoardNoteNumber.length - 1];

		this.chordOnDelay = settings.chordOnDelay ? settings.chordOnDelay : this.chordOnDelay;
		this.chordOffDelay = settings.chordOffDelay ? settings.chordOffDelay : this.chordOffDelay;
		this.strumDelay = settings.strumDelay ? settings.strumDelay : this.strumDelay;
		this.bridgeDelay = settings.bridgeDelay ? settings.bridgeDelay : this.bridgeDelay;
		this.autoSustainLength = settings.autoSustainLength ? settings.autoSustainLength : this.autoSustainLength;
		this.transpose = settings.transpose;

		this.noteToKey = settings.noteToKey;
		for (let key in this.noteToKey) {
			this.keyToNote[this.noteToKey[key]] = parseInt(key, 10);
		}
		for (let key in settings.chordMap) {
			let chord = settings.chordMap[key];
			this.#chordMap[key] = {};
			this.#chordMap[key].keys = chord.keys;
			this.#chordMap[key].root = chord.root;
			this.#chordMap[key].mutedNotes = chord.mutedNotes;
			this.#chordMap[key].playableNotes = [];
			this.#chordMap[key].rootNotes = [];
			this.#chordMap[key].notes = [];
			this.#chordMap[key].noteComposition = [chord.root];
			this.#chordMap[key].strings = chord.strings;
			for (let i = 0, c = chord.keys.length; i < c; i++) {
				let keyRoot = chord.keys[i].replace(/[0-9\-]+/g, "");
				this.#chordMap[key].notes[i] = this.keyToNote[chord.keys[i]];
				if (keyRoot == chord.root) {
					this.#chordMap[key].rootNotes.push(i);
				}
				if (this.#chordMap[key].mutedNotes.indexOf(i) < 0) {
					this.#chordMap[key].playableNotes.push(i);
					if (this.#chordMap[key].noteComposition.indexOf(keyRoot) < 0) {
						this.#chordMap[key].noteComposition.push(keyRoot);
					}
				}
			}
		}
		for (let key in this.#chordTriggers) {
			let trigger = this.#chordTriggers[key];
			if (trigger[0].constructor == Array) {
				let triggers = trigger;
				for (let i = 0, c = triggers.length; i < c; i++) {
					let trigger = triggers[i];
					trigger.sort(this.sortByNumber);
					trigger = JSON.stringify(trigger);
					this.triggerToChord[trigger] = key;
				}
			}
			else {
				trigger.sort(this.sortByNumber);
				trigger = JSON.stringify(trigger);
				this.triggerToChord[trigger] = key;
			}
		}
	}

	registerChordChanged(callback) {
		this.chordChanged = callback;
	}

	async #chordChanged(chordName) {
		//console.log(chordName);
	}
	chordChanged = this.#chordChanged;

	async #sendSpecialNoteOn(specialNote) {
		//console.log("Special Note On", specialNote);
	}
	sendSpecialNoteOn = this.#sendSpecialNoteOn;

	async #sendSpecialNoteOff(specialNote) {
		//console.log("Special Note Off", specialNote);
	}
	sendSpecialNoteOff = this.#sendSpecialNoteOff;


	async changeChord(n1) {
		console.log("Chord Fingering: ", n1);
		n1 = JSON.stringify(n1);
		let n0 = JSON.stringify(Object.assign([], this.#chordState.noteOnNumbers.sort(this.sortByNumber)));
		if (n0 == n1) {
			let newChordName = this.triggerToChord[n1];
			let lastChordName = this.#chordState.currentChordName;
			if (newChordName !== undefined) {
				if (lastChordName != newChordName) {
					// Chord changed, stop previous chord's string
					let lastChord = this.chordMap[lastChordName];
					let newChord = this.chordMap[newChordName];
					for (let i = 0, c = 6; i < c; i++) {
						if (lastChord.notes[i] != newChord.notes[i]) {
							// Chord change affect this string, stop any note it has been playing
							this.guitarStrings[i].stop();
							if (this.strumGuitarStrings[i]) {
								this.strumGuitarStrings[i].stop();
							}
						}
					}
					this.#chordState.currentChordName = newChordName;
					this.chordChanged(newChordName);
				}
				else {
					//console.log("Chord did not change and remains to be: ", newChordName);
					// Still registering as one chord change
				}
			}
			else {
				console.log("Unrecognized chord trigger", n1, "Reusing the last chord:", this.#chordState.currentChordName)
			}
		}
		else {
			//console.log("Chord change on going", n0, n1);
		}
	}

	async setStringState(stringIndex, noteAction, attack, release) {
		//console.log(noteAction, stringIndex, attack, release);
		this.#stringState.strings[stringIndex].lastNoteAction = noteAction;
		this.#stringState.strings[stringIndex].lastAttack = attack;
		this.#stringState.strings[stringIndex].lastRelease = release;
		this.#stringState.strings[stringIndex].timestamp = new Date().valueOf();
	}

	async strum(start, end, attack, release) {
		await this.delay(this.strumDelay);
		//console.log("Strum from string ", start, " to ", end, attack, release);
		let guitarStrings = this.guitarStrings;
		if (this.strumGuitarStrings.length == 6) {
			guitarStrings = this.strumGuitarStrings;
		}
		let chordName = this.#chordState.currentChordName;
		let chord = this.chordMap[chordName];
		if (this.#strumState.direction == "down") {
			for (let i = 0, c = guitarStrings.length; i < c; i++) {
				if (i >= start && i <= end) {
					if (chord.mutedNotes.indexOf(i) > -1) {
						continue;
					}
					let r0 = this.rand(2, 8);
					let r1 = this.rand(-10, 10);
					guitarStrings[i].play(chordName, attack + r1, release + r1);
					this.#stringState.lastPlayedString = i;
					await this.delay(r0);
				}
			}
			this.#strumState.direction = "up";
		}
		else {
			for (let i = guitarStrings.length - 1, c = -1; i > c; i--) {
				if (i >= start && i <= end) {
					if (chord.mutedNotes.indexOf(i) > -1) {
						continue;
					}
					let r0 = this.rand(5, 20);
					let r1 = this.rand(-10, 10);
					guitarStrings[i].play(chordName, attack + r1, release + r1);
					this.#stringState.lastPlayedString = i;
					await this.delay(r0);
				}
			}
			this.#strumState.direction = "down";
		}
	}

	async noteOnHandler(noteNumber, attack, release) {
		let stringNumber = this.#bridgeNotes.indexOf(noteNumber);

		if (this.#bridgeNotes.indexOf(noteNumber) > -1) {
			// this is a bridge note
			let chord = this.#chordMap[this.#chordState.currentChordName];
			if (chord.strings && chord.strings[stringNumber]) {
				//console.log(`Substitue string ${stringNumber}  with ${chord.strings[stringNumber]}`);
				let channel = chord.strings[stringNumber];
				this.guitarStrings[channel].stop();
				this.setStringState(channel, "on", attack, release);
			}
			else {
				this.guitarStrings[stringNumber].stop();
				this.setStringState(stringNumber, "on", attack, release);
			}
		}
		else if (noteNumber <= this.maxFingerBoardNoteNumber) {
			// this is a chord note
			if (this.#chordState.noteOnNumbers.indexOf(noteNumber) < 0) {
				this.#chordState.noteOnNumbers.push(noteNumber);
			}
			await this.delay(this.chordOnDelay);
			this.changeChord(Object.assign([], this.#chordState.noteOnNumbers.sort(this.sortByNumber)));
		}
		else if (noteNumber == this.#specialNotes.mutedNote.trigger) {
			// play the mutedNote
			//console.log("Guitar.noteOnHandler => mutedNote", noteNumber);
			this.sendSpecialNoteOn(this.#specialNotes.mutedNote);
		}
		else if (noteNumber == this.#specialNotes.silentStroke.trigger) {
			// play the silentStroke
			//console.log("Guitar.noteOnHandler => silentStroke", noteNumber);
			this.sendSpecialNoteOn(this.#specialNotes.silentStroke);
		}
		else if (noteNumber == this.#specialNotes.strumFull.trigger) {
			this.strum(0, 5, attack, release);
		}
		else if (noteNumber == this.#specialNotes.strumBass.trigger) {
			this.strum(0, 3, attack, release);
		}
		else if (noteNumber == this.#specialNotes.strumMid.trigger) {
			this.strum(2, 5, attack, release);
		}
		else if (noteNumber == this.#specialNotes.strumTreble.trigger) {
			this.strum(3, 5, attack, release);
		}
	}

	async noteOffHandler(noteNumber, attack, release) {
		let stringNumber = this.#bridgeNotes.indexOf(noteNumber);

		if (this.#bridgeNotes.indexOf(noteNumber) > -1) {
			// this is a bridge note
			let chord = this.#chordMap[this.#chordState.currentChordName];
			if (chord.strings && chord.strings[stringNumber] !== undefined) {
				//console.log(`Substitue string ${stringNumber} with ${chord.strings[stringNumber]}`);
				let channel = chord.strings[stringNumber];
				let noteToPlay = chord.notes[stringNumber];

				let stringState = this.#stringState.strings[channel];
				let now = new Date().valueOf();
				if (stringState.lastNoteAction == "on" && stringState.lastAttack < 45 && release < 45 && now - stringState.timestamp > 150) {
					this.guitarStrings[channel].stop();
					this.setStringState(channel, "off", release, attack);
				}
				else {
					this.guitarStrings[channel].playANote(noteToPlay, release, attack);
					this.#stringState.lastPlayedString = channel;
					this.setStringState(channel, "off", release, attack);
				}
			}
			else {
				let stringState = this.#stringState.strings[stringNumber];
				let now = new Date().valueOf();
				if (stringState.lastNoteAction == "on" && stringState.lastAttack < 45 && release < 45 && now - stringState.timestamp > 150) {
					this.guitarStrings[stringNumber].stop();
					this.setStringState(stringNumber, "off", release, attack);
				}
				else {
					this.guitarStrings[stringNumber].play(this.#chordState.currentChordName, release, attack);
					this.#stringState.lastPlayedString = stringNumber;
					this.setStringState(stringNumber, "off", release, attack);
				}
			}
		}
		else if (noteNumber <= this.maxFingerBoardNoteNumber) {
			// this is a chord note
			let noteOnIndex = this.#chordState.noteOnNumbers.indexOf(noteNumber);
			if (noteOnIndex > -1) {
				this.#chordState.noteOnNumbers.splice(noteOnIndex, 1);
			}
			if (this.#chordState.noteOnNumbers.length > 0) {
				console.log("Chord Off Delay: ", this.chordOffDelay);
				await this.delay(this.chordOffDelay);
			}
			this.changeChord(Object.assign([], this.#chordState.noteOnNumbers.sort(this.sortByNumber)));
		}
		else if (noteNumber == this.#specialNotes.mutedNote.trigger) {
			this.sendSpecialNoteOff(this.#specialNotes.mutedNote);
		}
		else if (noteNumber == this.#specialNotes.silentStroke.trigger) {
			this.sendSpecialNoteOff(this.#specialNotes.silentStroke);
		}
	}

	registerSendSpecialNoteOn(callback) {
		this.sendSpecialNoteOn = callback;
	}

	registerSendSpecialNoteOff(callback) {
		this.sendSpecialNoteOff = callback;
	}

	registerSpecialNotes(specialNotes) {
		if (specialNotes.mutedNote) {
			this.#specialNotes.mutedNote = specialNotes.mutedNote
		}
		if (specialNotes.silentStroke) {
			this.#specialNotes.silentStroke = specialNotes.silentStroke
		}
	}
}