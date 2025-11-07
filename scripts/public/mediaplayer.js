"use strict";
var playerSetup = false;
var playerPlaying = false;
var tracklist;
var songqueue;
var fetching;
var lastFetch;

function fetchTracklist() {
    const url = window.location.origin + window.location.pathname + ".json";
    console.log("Status", fetching, lastFetch );
    if( ! fetching ) {
      if( lastFetch !== url ) {
        fetching = url;
        const req = new Request(url);
        window.fetch(req)
        .then( (res) => {
              fetching = undefined;
              if( res.ok ) {
                  lastFetch = url;
                  res.json().then( (body) => {
                    console.log("Got a new playlist");
                    tracklist = body.slice(0);

                    // If the player is idle, set it up with the new playlist
                    console.log('Player is playing/at a track?!', playerPlaying);
                    if( !playerPlaying ) {
                        console.log("Setting up fetched tracklist");
                        const player = videojs('my-player');
                        console.log("My player is",player.el_);
                        player.playlist( tracklist );
                        if( ! songqueue) {
                            songqueue = tracklist.slice(0);
                            updatePlayqueue();
                        }
                    };
                  });
              } else {
                console.log("Error fetching playlist, ignored");
              }
        })
        .catch( (err) => {
            lastFetch = url;
            fetching = undefined;
        });
    } else {
      console.log("Already fetched", url);
    };
  } else {
    console.log("Already fetching something");
  }
}

function updateMediaSession(player) {
    // Somehow, player.playlist.currentItem() seems to get lost ?!
    console.log( "Current item", player.playlist.currentItem(), songqueue);
    let item = songqueue[  player.playlist.currentItem()];
    const artwork = [];

    if( item.poster ) {
        artwork.push( {
          src: item.poster,
          sizes: "400x400",
          type: "image/jpeg",
        } );
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      album: item.album,
      artist: item.artist,
      artwork: artwork,
      title: item.title,
    });
}

function connectMediaSession(player, mediaSession) {
    const SEEK_TIME = 10; // seconds
    navigator.mediaSession.setActionHandler('seekbackward', (e) => {
        player.currentTime(player.currentTime() - SEEK_TIME);
    });
    navigator.mediaSession.setActionHandler('seekforward', (e) => {
        player.currentTime(player.currentTime() + SEEK_TIME);
    });

    navigator.mediaSession.setActionHandler('previoustrack', (e) => {
      player.playlist.previous();
    });
    navigator.mediaSession.setActionHandler('nexttrack', (e) => {
      console.log("mediaSession: next");
      player.playlist.next();
    });

    navigator.mediaSession.setActionHandler('play', (e) => {
      console.log("mediaSession: play");
      player.play();
    });
    navigator.mediaSession.setActionHandler('pause', (e) => {
      console.log("mediaSession: pause");
      player.pause();
    });
    navigator.mediaSession.setActionHandler('stop', (e) => {
      player.stop();
    });
}

function initPlayer() {
    const player = videojs('my-player');
    if(! playerSetup) {
        console.log("Fresh page here...");
        playerSetup = true;
        player.ready( () => {
            console.log("Connecting events");
            // Well, we don't want to necessarily change the playlist here!
            // player.playlist( tracklist );


            player.on("error", (event) => {
              console.log("Player error", event.target.error.message);
            });

            const playerElement = document.getElementById('my-player');
            playerElement.addEventListener("error", (event) => {
              console.log("Raw player error", event.target.error.message);
            });

            // Update our display
            player.on("playlistitem", (i) => {
              console.log("event: playlistitem");
              const track = player.playlist.currentIndex();

              // This is only for songs that are on the current page ...
              // Remove the "track-playing" class from all tracks
              const tracks = document.querySelectorAll(".track-playing");
              for (let elt of tracks) {
                  elt.classList.remove("track-playing");
              };

              const el = document.getElementById("track-"+track);
              if( el ) {
                el.classList.add("track-playing");
              };
            });

            // Our own implementation of autoadvance, since the one videojs has
            // in the playlist plugin does not seem to work?!
            player.on("ended", (e) => {
              console.log("player: ended");
              playerPlaying = false;
              if( player.playlist.nextIndex() >= 1 ) {
                player.playlist.next();
              };
            });
            player.on(["playing",'play'], (e) => {
              console.log("player: playing");
              playerPlaying = true;
              //console.log(e);
              //const player = videojs(e.target);

              if( ! songqueue) {
                  // User clicked the "play" button of the player
                  songqueue = tracklist.slice(0);
                  updatePlayqueue();
              }

            });

            // Consider hooking prev/next controls to the mediaSession item
            // as well, so things work from a lockscreen
            if ("mediaSession" in navigator) {
                player.on('loadstart', () => {
                    console.log("event: loadstart -> mediaSession");
                    updateMediaSession(player);
                });
                connectMediaSession(player, navigator.mediaSession);
            };
      });
  } else {
      console.log("Already initialized");
  }
  console.log("initPlayer done");
}

let lastUrl;
function playTrack(track) {
  const player = videojs('my-player');
  console.log("Playing track",track);

  if( lastUrl != window.location.href ) {
      lastUrl = window.location.href;
      // Replace the current playlist with the current album
      songqueue = tracklist.slice(0);

      updatePlayqueue();
      console.log("Resetting playlist");
      player.playlist(songqueue);
      console.log(songqueue);
  };
  player.playlist.currentItem(track);
  player.ready( () => {
      console.log("Starting song", track);
      player.play();
      //player.ready();
  });
};

function updatePlayqueue() {
              console.log("Updating play queue div");

  // update the HTML of #playqueue with the new songqueue
  const playqueue = document.getElementById("playqueue");
  const newSongqueue = [];
  for ( let track of songqueue ) {
      let div = document.createElement("div");
      div.textContent = track.sources[0].src;
      newSongqueue.push( div );
  }

  playqueue.replaceChildren.apply( playqueue, newSongqueue); // boom
}

function hxInit() {
    console.log("Initializing HTMX");
    fetchTracklist();
};

function htmlInit() {
    console.log("Initializing HTML");
    initPlayer();
    fetchTracklist();
};


/* This now gets called on _every_ page change, actually for every swapped-in element ... */
htmx.onLoad( (elt) => {
//  console.log("Loaded element",elt);
  hxInit();
});
