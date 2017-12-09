var express = require('express');
var router = express.Router();
var path = require('path');

var request = require('request');
var cheerio = require('cheerio');

var Comment = require('../models/Comment.js');
var Article = require('../models/Article.js');

router.get('/', function(req, res) {
    res.redirect('/articles');
});

router.get('/scrape', function(req, res) {
    // request html
    request('http://www.sneakernews.com', function(error, response, html) {
        // load into cheerio
        var $ = cheerio.load(html);
        var titlesArray = [];
        // loop though each article
        $('.header-title').each(function(i, element) {
            var result = {};
            result.title = $(this).children('a').text();
            result.link = $(this).children('a').attr('href');

            //no empty titles or links
            if(result.title !== "" && result.link !== ""){
                //check for duplicates
                if(titlesArray.indexOf(result.title) == -1){

                    titlesArray.push(result.title);

                    // only add the article if is not already there
                    Article.count({ title: result.title}, function (err, test){
                        //if the test is 0, the entry is unique and good to save
                        if(test == 0){

                            //create new Article
                            var entry = new Article (result);

                            //save entry to mongodb
                            entry.save(function(err, doc) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log(doc);
                                }
                            });

                        }
                    });
                }
                else{
                    console.log('Article already exists.')
                }
            }
            else{
                console.log('Not saved to DB, missing data')
            }
        });
        // after scrape, redirects to index
        res.redirect('/');
    });
});

//get every article for DOM
router.get('/articles', function(req, res) {
    //sort by newest
    Article.find().sort({_id: -1})
    //send to handlebars
        .exec(function(err, doc) {
            if(err){
                console.log(err);
            } else{
                var artcl = {article: doc};
                res.render('index', artcl);
            }
        });
});

// To json
router.get('/articles-json', function(req, res) {
    Article.find({}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            res.json(doc);
        }
    });
});

router.get('/remove', function(req, res) {
    Article.remove({}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            console.log('removed all articles');
        }

    });
    res.redirect('/articles-json');
});

router.get('/readArticle/:id', function(req, res){
    var articleId = req.params.id;
    var hbsObj = {
        article: [],
        body: []
    };

    Article.findOne({ _id: articleId })
        .populate('comment')
        .exec(function(err, doc){
            if(err){
                console.log('Error: ' + err);
            } else {
                hbsObj.article = doc;
                var link = doc.link;
                request(link, function(error, response, html) {
                    var $ = cheerio.load(html);

                    $('#internal-pagination-data').each(function(i, element){
                        hbsObj.body = $(this).children('.pagination-content').children('p').eq(1).text();
                        //send article body and comments to article.handlebars through hbObj
                        console.log(hbsObj);
                        res.render('article', hbsObj);
                        //prevents loop through so it doesn't return an empty hbsObj.body
                        return false;
                    });
                });
            }

        });
});

// Create new comment
router.post('/comment/:id', function(req, res) {
    var user = req.body.name;
    var content = req.body.comment;
    var articleId = req.params.id;

    var commentObj = {
        name: user,
        body: content
    };

    //create new Comment model
    var newComment = new Comment(commentObj);

    newComment.save(function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            console.log(doc._id)
            console.log(articleId)
            Article.findOneAndUpdate({ "_id": req.params.id }, {$push: {'comment':doc._id}}, {new: true})
            //execute everything
                .exec(function(err, doc) {
                    if (err) {
                        console.log(err);
                    } else {
                        res.redirect('/readArticle/' + articleId);
                    }
                });
        }
    });
});

module.exports = router;