CherryGit
======================================

Git GUI made with Python + JavaScript, HTML5 and CSS3
-------------------------------------

CherryGit is a graphical user interface for git. Currently in alpha version, so far works:

**Work:**

- pull
- push
- stage
- unstage
- commit
- checkout
- create branch

**TODO:**

- draw graph of commits
- view tree of a revision
- view blame of a file
- view the history of a file
- graphical interface for config (config.yaml)
- Interface improvements

Installing
----------
    
### In Ubuntu

##
    sudo apt-get install python-setuptools python-webkit python-cherrypy3
    git clone https://github.com/individuo7/CherryGit.git
    cd CherryGit
    sudo pip install -r requirements.txt

Launch
----------

First edit config.yaml file, example:

##
    mergetool: meld
    repositories:
        - name: Example Repository
          path: /the/path/of/my/main/repository
          default: yes
        - name: Another Repository
          path: /the/path/of/my/second/repository
          default: no

Later run the command:

##
    ./cherrygit

Or just for the web interface:

##
    ./cherrygit --server


Screenshots
----------


![](https://dl.dropbox.com/u/5594456/cherrygit/1.png?raw=true)


![](https://dl.dropbox.com/u/5594456/cherrygit/2.png?raw=true)


![](https://dl.dropbox.com/u/5594456/cherrygit/3.png?raw=true)


![](https://dl.dropbox.com/u/5594456/cherrygit/4.png?raw=true)


![](https://dl.dropbox.com/u/5594456/cherrygit/5.png?raw=true)
