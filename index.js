var fs = require( "fs" ),
    _ = require( "underscore" ),
    request = require( "request" ),
    postal = require( "postal" ),
    Monologue = require( "monologue.js" )( _ ),
    machina = require( "machina" ),
    jsdom = require( "jsdom" );

require( "monopost" )( _, Monologue, postal );
require( "machina.postal" )( postal, machina );

postal.addWireTap(function( env ) {
    // console.log( JSON.stringify( env ) );
});

var win, repos = [], i = 0;

var TEMPLATE = [
    "### <%= plugin %>  ",
    " <%= description %>  ",
    "```anvil install <%= plugin %>```   ",
    " [Github](<%= link %>)  ",
    " [NPM](<%= npmLink %>)  "
    ].join( "\n" );

var SearchFSM = machina.Fsm.extend({
    initialState: "uninitialized",
    namespace: "app",
    states: {
        uninitialized: {
            "npm.anvil": function() {
                var self = this;

                request( "https://npmjs.org/browse/keyword/anvil", function( err, response, body ) {
                    self.handle( "npm.anvil.retrieved", body );
                });
            },
            "npm.anvil.retrieved": function( content ) {
                var self = this;

                self.emit( "parse", {
                    content: content,
                    handle: "npm.anvil.parsed"
                });
            },
            "npm.anvil.parsed": function( plugins ) {
                this.plugins = plugins;
                this.transition( "initialized" );
            }

        },
        initialized: {
            _onEnter: function() {
                this.handle( "search" );
            },
            "search": function() {
                if ( this.plugins.length <= 0 ) {
                    this.transition( "done" );
                    return;
                }

                this.handle( "searching" );
            },
            "searching": function() {
                var self = this;

                console.log( "searching for: " + this.plugins[ 0 ] );
                
                request( "https://npmjs.org/package/" + this.plugins[ 0 ], function( err, response, body ) {
                    self.emit( "parse", {
                        content: body,
                        handle: "searched",
                        info: {
                            plugin: self.plugins[ 0 ]
                        }
                    });
                });
            },
            "searched": function( link ) {
                this.plugins.shift();

                repos.push( link );
                this.handle( "search" );
            }
        },
        done: {
            _onEnter: function() {
                var template = _.template( TEMPLATE ),
                    content = [];

                _.each( repos, function( repo ) {
                    content.push( template( repo ));
                });

                fs.writeFile( "./plugins.json", content.join( "\n" ) , function (err) {
                    console.log( "done with " + repos.length + " found..." );
                    process.exit( 0 );
                });
            }
        }
    }
});

var App = function() {
    this.plugins = [];
    this.search = new SearchFSM({
        plugins: this.plugins
    });

    this.search.handle( "npm.anvil" );
};

Monologue.mixin( App );

var app = new App();

app.search.on( "parse", function( data ) {
    
    jsdom.env({
            html: data.content,
            scripts: [ "http://code.jquery.com/jquery.js" ]
        },
        function( errors, window ) {
            win = window;
            
            app.emit( "jsdom.parse", {
                handle: data.handle,
                info: data.info
            });
        }
    );
});

app.on( "jsdom.parse", function( data ) {
    var handleData,
        parsers = {
            "npm.anvil.parsed": function() {
                var $ = win.jQuery,
                    plugins = [];

                $(".row p a").each(function() {
                    plugins.push( $(this).attr( "href" ).split( "/" ).pop() );
                });

                return plugins;
            },
            "searched": function( data ) {
                var $ = win.jQuery,
                    link;

                $( "td a" ).each(function() {
                    if ( ~$( this ).attr( "href" ).indexOf( "github" ) ) {
                        link = $( this ).attr( "href" );
                    }
                });

                return {
                    link: link,
                    plugin: data.info.plugin,
                    description: $( ".description" ).text()
                };
            }
        };
    

    if ( parsers.hasOwnProperty( data.handle ) ) {
        handleData = parsers[ data.handle ]( data );
        app.search.handle( data.handle, handleData );
    }
});