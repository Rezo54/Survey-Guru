# Survey Guru infrastructure boundary

This directory will hold environment/deployment configuration only when those choices are ready to be implemented.

Current rules:

- local/test/production configurations remain separated;
- no production secrets are committed;
- PWA and Android clients never receive Firebase Admin credentials;
- protected business access goes through the Survey Guru API;
- no autonomous agent receives simultaneous authority over code, production credentials and deployment.
