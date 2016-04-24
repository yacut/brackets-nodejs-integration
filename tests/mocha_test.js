'use strict';

var assert = require('assert');

describe('Brackets mocha runner', function () {
    this.timeout(0);

    before("Before all hook", function (done) {
        console.info("before all");
        //throw new Error("whatever");
        done();
    });

    it('should start log', function (done) {
        console.info("Hello");
        done();
    });

    describe('Handle console output', function () {
        it('should throw', function () {
            console.error(new Error("test#1"));
            console.log('sgsdglknsldgnslkdgnlasgndl;asdgnlasdgnasldg0');
        });

        it('should return console log text', function () {
            console.info("test#2");
            assert.equal('1', 1);
        });

        it('should compare two objects', function () {
            console.info("test#3");
            var foo = {
                "largestCities": [
                          "São Paulo",
                          "Buenos Aires",
                          "Rio de Janeiro",
                          "Lima",
                          "Bogotá"
                          ],
                "languages": [
                        "spanish",
                        "portuguese",
                        "english",
                        "dutch",
                        "french",
                        "quechua",
                        "guaraní",
                        "aimara",
                        "mapudungun"
                      ]
            };
            var bar = {
                "largestCities": [
                                  "São Paulo",
                                  "Buenos Aires",
                                  "Rio de Janeiro",
                                  "Lima",
                                  "Bogotá"
                                  ],
                "languages": [
                            "spanish",
                            "portuguese",
                            "inglés",
                            "dutch",
                            "french",
                            "quechua",
                            "guaraní",
                            "aimara",
                            "mapudungun"
                            ]
            };
            assert.deepEqual(foo, bar);
        });

        it('should compare true and false', function () {
            assert.equal(true, false);
        });

        describe('Handle console output deeper', function () {
            it('should delay test and pass', function (done) {
                console.info("test with delay");
                assert.ok(true);
                setTimeout(done, 1000);
            });
        });

        after("after this describe hook", function () {
            console.info("after hook");
        });
    });

    describe('Handle console output1', function () {
        it('should return console log text', function () {
            console.info("test pass");
        });
    });
});
