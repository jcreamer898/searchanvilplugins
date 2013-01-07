var fs = require( "fs" ),
    _ = require( "underscore" ),
    postal = require( "postal" ),
    Monologue = require( "monologue.js" )( _ ),
    machina = require( "machina" ),
    npm = require('npm');

require( "monopost" )( _, Monologue, postal );
require( "machina.postal" )( postal, machina );

postal.addWireTap(function( env ) {
    // console.log( JSON.stringify( env ) );
});

var NPM_CONFIG = {
  registry: "https://registry.npmjs.org/",
  loglevel: "silent"
};

var isSilent = NPM_CONFIG.loglevel === "silent";

var win, repos = [], i = 0;

var TEMPLATE = [
    "### <%= name %>  ",
    " <%= description %>  ",
    "```anvil install <%= name %>```   ",
    " [<%= link %>](<%= link %>)  ",
    " [<%= npmLink %>](<%= npmLink %>)  \n"
    ].join( "\n" );

var SearchFSM = machina.Fsm.extend({
    initialState: "loadnpm",
    namespace: "app",
    states: {
        loadnpm: {
            "npm.anvil": function() {
                var self = this;


                npm.load( NPM_CONFIG, function (err, npm) {
                    npm.commands.search(['/^anvil'], isSilent, function (err, results) {
                        self.handle( "npm.anvil.retrieved", results );
                    });
                });

            },
            "npm.anvil.retrieved": function( plugins ) {
                this.list = _.keys( plugins );

                this.handle( "npm.anvil.plugin" );
            },
            "npm.anvil.plugin": function( plugins ) {
                if ( this.list.length === 0 || typeof this.list[ 0 ] === "undefined" ) {
                    this.transition( "done" );
                    return;
                }
                
                console.log( "retrieving: " + this.list[0] );

                npm.commands.view( [ this.list[ 0 ] ], isSilent, function( err, results ) {
                    this.handle( "npm.anvil.plugin.retrieved", results, plugins );
                }.bind( this ));
            },
            "npm.anvil.plugin.retrieved": function( plugin ) {
                var version = _.keys( plugin )[ 0 ];
                this.plugins.push( plugin[ version ] );

                this.list.shift();
                this.handle( "npm.anvil.plugin" );
            }
        },
        done: {
            _onEnter: function() {
                var template = _.template( TEMPLATE ),
                    content = [];

                _.each( this.plugins, function( plugin ) {
                    plugin.link = plugin.repository.url.replace( "git://", "http://" ).replace( /.git$/, "");
                    plugin.npmLink = "https://npmjs.org/package/" + plugin.name;
                   
                    content.push( template( plugin ));
                });

                fs.writeFile( "./plugins.md", content.join( "\n" ) , function (err) {
                    console.log( "done with " + _.keys(this.plugins).length + " found..." );
                    process.exit( 0 );
                }.bind( this ));
                
            }
        }
    }
});

var App = function() {
    this.plugins = [];
    this.list = [];

    this.search = new SearchFSM({
        plugins: this.plugins,
        list: this.list
    });

    this.search.handle( "npm.anvil" );
};

Monologue.mixin( App );

var app = new App();