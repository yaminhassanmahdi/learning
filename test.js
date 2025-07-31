const { YoutubeTranscript } = require('youtube-transcript');

YoutubeTranscript.fetchTranscript('https://youtu.be/0vVofAhAYjc?list=PLgUwDviBIf0oE3gA41TKO2H5bHpPd7fzn')

    .then(transcript => {
        if (transcript && transcript.length > 0) {
            const fullTranscript = transcript.map(item => item.text).join(' ');
            console.log(fullTranscript);
        } else {
            console.log("No captions found for this video.");
        }
    })
    .catch(err => {
        console.error("Failed to fetch transcript or no captions found:", err.message);
       
    });