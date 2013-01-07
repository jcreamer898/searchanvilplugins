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
  registry: 'https://registry.npmjs.org/',
  loglevel: 'silent'
};

var win, repos = [], i = 0;

var TEMPLATE = [
    "### <%= name %>  ",
    " <%= description %>  ",
    "```anvil install <%= name %>```   ",
    " [Github](<%= link %>)  ",
    " [NPM](<%= npmLink %>)  \n"
    ].join( "\n" );

var SearchFSM = machina.Fsm.extend({
    initialState: "loadnpm",
    namespace: "app",
    states: {
        loadnpm: {
            "npm.anvil": function() {
                var self = this;


                npm.load( NPM_CONFIG, function (err, npm) {
                    var isSilent = NPM_CONFIG.loglevel === 'silent';

                    npm.commands.search(['/^anvil'], isSilent, function (err, results) {
                        self.handle( "npm.anvil.retrieved", results );
                    });
                });

            },
            "npm.anvil.retrieved": function( plugins ) {
                this.plugins = plugins;
                this.transition( "done" );
            }
        },
        done: {
            _onEnter: function() {
                var template = _.template( TEMPLATE ),
                    content = [];

                _.each( this.plugins, function( repo ) {
                    repo.link = "http://github.com/" + repo.maintainers[0].replace(/_|=/g, "" ) + "/" + repo.name;
                    repo.npmLink = "https://npmjs.org/package/" + repo.name;
                   
                    content.push( template( repo ));
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
    this.search = new SearchFSM({
        plugins: this.plugins
    });

    this.search.handle( "npm.anvil" );
};

Monologue.mixin( App );

var app = new App();