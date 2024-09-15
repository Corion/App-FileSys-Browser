package MojoX::ChangeNotify 0.01;
use strict;
use warnings;

use File::ChangeNotify;
use File::ChangeNotify::Event;
use Mojo::IOLoop::Subprocess;
use Mojo::Base 'Mojo::EventEmitter';

use 5.020; # for signatures
use experimental 'signatures';

has 'child';

sub instantiate_watcher($self, %options) {
    my $subprocess = Mojo::IOLoop::Subprocess->new();
    $self->child( $subprocess );

    $subprocess->on('progress' => sub( $subprocess, @events ) {
        # Emit "changed" events

        for my $ev (@events) {
            delete $ev->{attributes} unless $ev->{has_attributes};
            delete $ev->{content} unless $ev->{has_content};

            $self->emit( $ev->{type}, File::ChangeNotify::Event->new( $ev ));
        };
    });

    # Operation that would block the event loop for 5 seconds (with promise)
    $subprocess->run_p(sub($subprocess) {
        my $watcher = File::ChangeNotify->instantiate_watcher( %options );
        while( my @events = $watcher->wait_for_events()) {
            #warn sprintf "Child got '%s'", $events[0]->type;

            @events = map {
                +{ type           => $_->type,
                   path           => $_->path,
                   attributes     => $_->attributes,
                   has_attributes => $_->has_attributes,
                   content        => $_->content,
                   has_content    => $_->has_content,
                },
            } @events;

            $subprocess->progress( @events );
        };
    })->catch(sub  {
        my $err = shift;
        say "Subprocess error: $err";
    });
};

# emits "changed"

1;
