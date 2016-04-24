'use strict';

var expect = require('chai').expect;

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
        it('should not throw', function () {
            console.error(new Error("test1"));
            console.log('sgsdglknsldgnslkdgnlasgndl;asdgnlasdgnasldg0');
        });

        it('should return console log text', function () {
            console.info("test2");
            expect('everthing').to.be.ok;
            expect(1).to.be.ok;
            expect(false).to.not.be.ok;
            expect(undefined).to.not.be.ok;
            expect(null).to.not.be.ok;
        });

        it('should return console log text', function () {
            console.info("test2");
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

            expect(foo).to.deep.equal({
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
            });
        });

        it('should return console log text 3', function () {
            expect(true).to.deep.equal(false);
        });

        describe('Handle console output deeper', function () {
            it('should log something', function (done) {
                console.info("test3");
                expect({
                        foo: {
                            bar: {
                                baz: 'quux'
                            }
                        }
                    })
                    .to.have.deep.property('foo.bar.baz', 'quux');
                setTimeout(done, 1000);
            });
        });

        after("after this describe hook", function () {
            console.info("after hook");
        });
    });

    describe('Handle console output1', function () {
        it('should return console log text', function () {
            console.info("pass");
        });
    });
});
