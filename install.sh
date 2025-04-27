#!/bin/bash
# backend install script for python 

python -m venv venv

cd back
pip install -r requirements.txt
cd ..
cd front
npm install

